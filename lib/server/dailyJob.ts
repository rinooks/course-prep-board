import "server-only";

// 매일 아침 알림 메일 작업 (app/api/cron/daily가 부른다).
// 1) 팀원, 휴지통에 없는 과정, 입금 전 강사료, 진행 중 과정의 내일 회차를 읽는다
// 2) 받는 사람마다 메일 한 통을 만든다 (lib/domain/digest.ts)
// 3) mailLog/{오늘}_{이메일 해시}를 create()로 먼저 잡고 보낸다. 이미 있으면 건너뛴다 → 크론이 두 번 불려도 한 번만 간다.
//    보내기에 실패하면 잡은 기록을 지워 다시 실행할 때 보낼 수 있게 한다.
// 4) 30일 지난 mailLog와 90일 지난 최근 활동(activity)을 지운다.
// 돌려주는 요약에는 개수만 담는다 (주소 없음).

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { activityCutoff } from "@/lib/domain/activity";
import { READ_TIMEOUT_MS, WRITE_TIMEOUT_MS, withTimeout } from "@/lib/domain/async";
import { addDays, todayInSeoul, type DateString } from "@/lib/domain/dates";
import { buildDailyDigests, type DigestEmail } from "@/lib/domain/digest";
import type { NoticeSession } from "@/lib/domain/notices";
import { describeAdminError, describeForLog, describeMailError, errorCodeOf } from "./errors";
import { adminDb } from "./firebaseAdmin";
import { createMailer, type Mailer } from "./mailer";
import { MAIL_LOG_COLLECTION, mailLogCutoff, mailLogId } from "./mailLog";
import { courseFromData, feeFromData, memberFromData, sessionFromData } from "./records";

/** gRPC 상태 번호 6 = ALREADY_EXISTS (create()로 만들려는 문서가 이미 있음) */
const ALREADY_EXISTS = 6;
/** 동시에 보내는 메일 수. Gmail이 한꺼번에 많은 연결을 막으므로 작게 둔다 */
const SEND_CONCURRENCY = 2;
/** 한 번에 지우는 오래된 기록 수 (Firestore 묶음 쓰기 한도 500 아래) */
const CLEANUP_LIMIT = 400;

export interface DailyJobSummary {
  date: DateString;
  /** 메일을 받을 사람 수 */
  recipients: number;
  sent: number;
  /** 오늘 이미 보내서 건너뛴 수 */
  alreadySent: number;
  failed: number;
  /** 메일에 들어간 내일 강의·미입금 강사료 줄 수 (받는 사람마다 센다) */
  lectureItems: number;
  feeItems: number;
  /** 지운 오래된 mailLog 수 */
  cleanedLogs: number;
  /** 지운 오래된 최근 활동 수 */
  cleanedActivity: number;
  /** 실패 이유 (같은 이유는 한 번만, 주소 없음) */
  failureReasons: string[];
}

async function loadInputs(db: Firestore, today: DateString) {
  const tomorrow = addDays(today, 1);
  const [membersSnap, coursesSnap, feesSnap] = await Promise.all([
    withTimeout(db.collection("members").get(), READ_TIMEOUT_MS),
    // 진행 중 + 보관 과정 (보관한 과정의 미입금 강사료도 알린다)
    withTimeout(db.collection("courses").where("deletedAt", "==", null).get(), READ_TIMEOUT_MS),
    withTimeout(db.collection("fees").where("paidDate", "==", null).get(), READ_TIMEOUT_MS),
  ]);

  const members = membersSnap.docs.map((doc) => memberFromData(doc.id, doc.data()));
  const courses = coursesSnap.docs.map((doc) => courseFromData(doc.id, doc.data()));
  const fees = feesSnap.docs.map((doc) => feeFromData(doc.id, doc.data()));

  // 담당 강사가 있는 진행 중 과정만, 과정마다 "date == 내일"로 회차를 읽는다.
  // 칸 하나 조건이라 자동 색인으로 충분하다 (컬렉션 그룹 쿼리는 새 색인이 필요해 쓰지 않는다).
  const lectureCourses = courses.filter(
    (course) => course.status === "active" && course.deletedAt === null && course.instructorEmails.length > 0,
  );
  const sessionSnaps = await Promise.all(
    lectureCourses.map((course) =>
      withTimeout(
        db.collection("courses").doc(course.id).collection("sessions").where("date", "==", tomorrow).get(),
        READ_TIMEOUT_MS,
      ),
    ),
  );
  const sessionsByCourse: Record<string, NoticeSession[]> = {};
  lectureCourses.forEach((course, index) => {
    sessionsByCourse[course.id] = sessionSnaps[index].docs.map((doc) => sessionFromData(doc.id, doc.data()));
  });

  return { members, courses, fees, sessionsByCourse };
}

type Delivery = { outcome: "sent" } | { outcome: "already-sent" } | { outcome: "failed"; reason: string };

async function deliver(db: Firestore, mailer: Mailer, today: DateString, digest: DigestEmail): Promise<Delivery> {
  const ref = db.collection(MAIL_LOG_COLLECTION).doc(mailLogId(today, digest.to));

  try {
    await withTimeout(
      ref.create({
        date: today,
        kind: "daily",
        status: "sending",
        lectureCount: digest.lectureCount,
        feeCount: digest.feeCount,
        createdAt: FieldValue.serverTimestamp(),
      }),
      WRITE_TIMEOUT_MS,
    );
  } catch (error) {
    if (errorCodeOf(error) === ALREADY_EXISTS) return { outcome: "already-sent" };
    console.error("[daily] 보낸 기록 만들기 실패:", describeForLog(error));
    return { outcome: "failed", reason: describeAdminError(error).message };
  }

  try {
    await mailer.send(digest);
  } catch (error) {
    console.error("[daily] 메일 보내기 실패:", describeForLog(error));
    // 다음 실행에서 다시 보낼 수 있게 잡아 둔 기록을 지운다
    await withTimeout(ref.delete(), WRITE_TIMEOUT_MS).catch((deleteError: unknown) => {
      console.error("[daily] 보낸 기록 지우기 실패:", describeForLog(deleteError));
    });
    return { outcome: "failed", reason: describeMailError(error) };
  }

  // 보낸 것은 확실하므로, 표시 바꾸기에 실패해도 기록만 남긴다
  await withTimeout(ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp() }), WRITE_TIMEOUT_MS).catch(
    (updateError: unknown) => {
      console.error("[daily] 보낸 기록 고치기 실패:", describeForLog(updateError));
    },
  );
  return { outcome: "sent" };
}

/** items를 limit개씩 동시에 처리한다. task는 오류를 던지지 않아야 한다 */
async function runLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

async function cleanOldLogs(db: Firestore, today: DateString): Promise<number> {
  const snapshot = await withTimeout(
    db.collection(MAIL_LOG_COLLECTION).where("date", "<", mailLogCutoff(today)).limit(CLEANUP_LIMIT).get(),
    READ_TIMEOUT_MS,
  );
  if (snapshot.empty) return 0;
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await withTimeout(batch.commit(), WRITE_TIMEOUT_MS);
  return snapshot.size;
}

/** 90일 지난 최근 활동 기록을 지운다 (서버 함수가 쓰는 activity 컬렉션) */
async function cleanOldActivity(db: Firestore, now: Date): Promise<number> {
  const snapshot = await withTimeout(
    db
      .collection("activity")
      .where("createdAt", "<", Timestamp.fromDate(activityCutoff(now)))
      .limit(CLEANUP_LIMIT)
      .get(),
    READ_TIMEOUT_MS,
  );
  if (snapshot.empty) return 0;
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await withTimeout(batch.commit(), WRITE_TIMEOUT_MS);
  return snapshot.size;
}

/** 오늘(한국 날짜) 알림 메일을 보낸다. 설정(환경 변수)이 없거나 데이터를 못 읽으면 오류를 던진다 */
export async function runDailyJob(now: Date = new Date()): Promise<DailyJobSummary> {
  const today = todayInSeoul(now);
  const db = adminDb();
  const inputs = await loadInputs(db, today);
  const digests = buildDailyDigests({ today, ...inputs, appUrl: process.env.APP_BASE_URL });

  const summary: DailyJobSummary = {
    date: today,
    recipients: digests.length,
    sent: 0,
    alreadySent: 0,
    failed: 0,
    lectureItems: digests.reduce((total, digest) => total + digest.lectureCount, 0),
    feeItems: digests.reduce((total, digest) => total + digest.feeCount, 0),
    cleanedLogs: 0,
    cleanedActivity: 0,
    failureReasons: [],
  };

  if (digests.length > 0) {
    const mailer = createMailer();
    const reasons = new Set<string>();
    try {
      await runLimited(digests, SEND_CONCURRENCY, async (digest) => {
        const result = await deliver(db, mailer, today, digest);
        if (result.outcome === "sent") summary.sent += 1;
        else if (result.outcome === "already-sent") summary.alreadySent += 1;
        else {
          summary.failed += 1;
          reasons.add(result.reason);
        }
      });
    } finally {
      mailer.close();
    }
    summary.failureReasons = [...reasons];
  }

  try {
    summary.cleanedLogs = await cleanOldLogs(db, today);
  } catch (error) {
    // 청소는 다음 날 다시 하면 되므로 작업 전체를 실패로 만들지 않는다
    console.error("[daily] 오래된 기록 지우기 실패:", describeForLog(error));
  }
  try {
    summary.cleanedActivity = await cleanOldActivity(db, now);
  } catch (error) {
    console.error("[daily] 오래된 최근 활동 지우기 실패:", describeForLog(error));
  }

  return summary;
}
