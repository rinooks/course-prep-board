// 요구사항: 최근 활동 기록(activity/{id}, PRD F9)
// - 초대된 팀원은 읽는다 (과정 보드의 "courseId == 과정, 새것부터 5개" 질의 포함)
// - 로그인하지 않았거나 초대받지 않은 사람은 못 읽는다
// - 화면에서는 아무도(관리자도) 쓰거나 고치거나 지울 수 없다. 서버 함수(Admin SDK)만 쓴다

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { ADMIN, BOOTSTRAP_EMAIL, CARD_ID, COURSE_ID, STRANGER, TEACHER, TEACHER2 } from "./support/constants";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();
const ACTIVITY_ID = "lecture-file-1";

/** 서버 함수가 남기는 기록 모양 */
function activityDoc() {
  return {
    kind: "lecture-uploaded",
    courseId: COURSE_ID,
    courseTitle: "A사 신입사원 AI 활용 과정",
    cardId: CARD_ID,
    cardTitle: "교안 작성",
    actorEmail: TEACHER,
    actorName: "김강사",
    fileName: "교안.pptx",
    fromStage: "lecture",
    toStage: "rehearsal",
    message: "김강사님이 「교안.pptx」 교안을 올려 '교안 작성' 카드를 '교안'에서 '리허설'로 옮겼습니다.",
    createdAt: serverTimestamp(),
  };
}

async function seedActivity(): Promise<void> {
  await rules.privileged((db) => setDoc(doc(db, "activity", ACTIVITY_ID), activityDoc()));
}

function boardQuery(db: Firestore) {
  return query(collection(db, "activity"), where("courseId", "==", COURSE_ID), orderBy("createdAt", "desc"), limit(5));
}

describe("읽기", () => {
  it("초대된 팀원은 기록 하나와 과정 보드 질의를 읽는다", async () => {
    await seedActivity();
    const db = rules.as(TEACHER2);
    await assertSucceeds(getDoc(doc(db, "activity", ACTIVITY_ID)));
    await assertSucceeds(getDocs(boardQuery(db)));
  });

  it("첫 관리자는 팀원 문서가 생기기 전에도 읽는다", async () => {
    await seedActivity();
    await assertSucceeds(getDocs(boardQuery(rules.as(BOOTSTRAP_EMAIL))));
  });

  it("로그인하지 않았거나 초대받지 않은 사람은 못 읽는다", async () => {
    await seedActivity();
    await assertFails(getDoc(doc(rules.anonymous(), "activity", ACTIVITY_ID)));
    await assertFails(getDocs(boardQuery(rules.as(STRANGER))));
  });
});

describe("쓰기는 화면에서 아무도 못 한다", () => {
  it("강사·관리자 모두 만들 수 없다", async () => {
    await assertFails(setDoc(doc(rules.as(TEACHER), "activity", "fake"), activityDoc()));
    await assertFails(setDoc(doc(rules.as(ADMIN), "activity", "fake"), activityDoc()));
  });

  it("있는 기록을 고치거나 지울 수 없다", async () => {
    await seedActivity();
    const db = rules.as(ADMIN);
    await assertFails(updateDoc(doc(db, "activity", ACTIVITY_ID), { message: "바꾼 문장" }));
    await assertFails(deleteDoc(doc(db, "activity", ACTIVITY_ID)));
  });
});
