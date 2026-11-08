// 알림 목록 만들기 (순수 함수). 앱 안 알림(머리글 종·홈 띠)과 매일 아침 메일(digest.ts)이 같이 쓴다.
// - 내일 강의: 진행 중인 과정의 내일 회차. 그 과정의 담당 강사에게 알린다.
// - 미입금 강사료: 입금 예정일이 지났는데 입금일이 없는 강사료. 강사 본인과 관리자에게 알린다.
// Firebase를 import하지 않는다. 테스트: tests/unit/notices.test.ts

import { addDays, formatDateKo, isDateString, type DateString } from "./dates";
import { feeStatus, formatWon, overdueDays } from "./fees";
import type { Course, Fee, Member, Session } from "@/lib/data/types";

export type NoticeCourse = Pick<Course, "id" | "title" | "client" | "instructorEmails" | "status" | "deletedAt">;
export type NoticeSession = Pick<Session, "id" | "date" | "startTime" | "location" | "audience">;
export type NoticeFee = Pick<
  Fee,
  "id" | "courseId" | "instructorEmail" | "label" | "amount" | "dueDate" | "paidDate"
>;
export type NoticeMember = Pick<Member, "email" | "role" | "displayName">;

/** 미입금 강사료 알림이 가는 화면 (강사료 화면의 "미입금" 보기) */
export const OVERDUE_FEES_PATH = "/fees?status=overdue";

export function coursePath(courseId: string): string {
  return `/courses/${encodeURIComponent(courseId)}`;
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** "A사 신입사원 입문 과정". 과정 이름에 고객사 이름이 이미 들어 있으면 붙이지 않는다 */
export function courseLabel(course: Pick<NoticeCourse, "title" | "client">): string {
  const title = course.title.trim();
  const client = course.client.trim();
  if (!client || title.includes(client)) return title;
  return `${client} ${title}`;
}

/** 장소·대상을 " · "로 잇는다. 둘 다 없으면 빈 문자열 */
export function sessionPlace(session: Pick<NoticeSession, "location" | "audience">): string {
  return [session.location, session.audience].map((part) => part.trim()).filter(Boolean).join(" · ");
}

/** 사람 이름: 팀원 목록에 이름이 있으면 이름, 없으면 이메일 */
export function personLabel(email: string, members: readonly NoticeMember[]): string {
  const member = members.find((item) => sameEmail(item.email, email));
  const name = member?.displayName.trim() ?? "";
  return name.length > 0 ? name : email;
}

export interface LectureItem {
  course: NoticeCourse;
  session: NoticeSession;
}

/**
 * date에 있는 강의 회차. 진행 중이고 휴지통에 없는 과정만.
 * 순서: 시작 시간(없으면 뒤로) → 과정 이름.
 */
export function lecturesOn(
  date: DateString,
  courses: readonly NoticeCourse[],
  sessionsByCourse: Readonly<Record<string, readonly NoticeSession[] | undefined>>,
): LectureItem[] {
  const items: LectureItem[] = [];
  for (const course of courses) {
    if (course.status !== "active" || course.deletedAt !== null) continue;
    for (const session of sessionsByCourse[course.id] ?? []) {
      if (session.date === date) items.push({ course, session });
    }
  }
  return items.sort((a, b) => {
    const timeA = a.session.startTime ?? "99:99";
    const timeB = b.session.startTime ?? "99:99";
    if (timeA !== timeB) return timeA < timeB ? -1 : 1;
    const titleOrder = courseLabel(a.course).localeCompare(courseLabel(b.course), "ko");
    if (titleOrder !== 0) return titleOrder;
    return a.session.id < b.session.id ? -1 : a.session.id > b.session.id ? 1 : 0;
  });
}

/** 이 사람이 담당 강사인 강의만 */
export function lecturesFor(email: string, items: readonly LectureItem[]): LectureItem[] {
  return items.filter((item) => item.course.instructorEmails.some((instructor) => sameEmail(instructor, email)));
}

export interface OverdueFeeItem {
  fee: NoticeFee;
  course: NoticeCourse;
  /** 입금 예정일에서 지난 날 수 (1 이상) */
  days: number;
}

/**
 * 미입금 강사료 (오래 밀린 순).
 * 과정을 찾을 수 없거나 휴지통에 있는 과정의 강사료는 알리지 않는다 (과정을 지웠다면 정리 대상이다).
 * 날짜가 이상하게 저장된 강사료는 계산이 멈추지 않게 건너뛴다.
 */
export function overdueFeeItems(
  fees: readonly NoticeFee[],
  courses: readonly NoticeCourse[],
  today: DateString,
): OverdueFeeItem[] {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const items: OverdueFeeItem[] = [];
  for (const fee of fees) {
    if (!isDateString(fee.dueDate)) continue;
    if (feeStatus(fee, today) !== "overdue") continue;
    const course = courseById.get(fee.courseId);
    if (!course || course.deletedAt !== null) continue;
    items.push({ fee, course, days: overdueDays(fee, today) });
  }
  return items.sort((a, b) => {
    if (a.days !== b.days) return b.days - a.days;
    return a.fee.id < b.fee.id ? -1 : a.fee.id > b.fee.id ? 1 : 0;
  });
}

/** "A사 신입사원 입문 과정 1회차" — 항목 이름(label)이 없으면 과정 이름만 */
export function feeTitle(item: Pick<OverdueFeeItem, "fee" | "course">): string {
  const label = item.fee.label.trim();
  return label ? `${courseLabel(item.course)} ${label}` : courseLabel(item.course);
}

// ---------- 앱 안 알림 ----------

export type NoticeKind = "lecture" | "overdueFee";

export interface Notice {
  /** 목록 key: "lecture:과정id:회차id", "fee:강사료id" */
  id: string;
  kind: NoticeKind;
  /** 배지 글자: "내일 강의", "미입금" */
  label: string;
  /** 굵은 첫 줄 */
  text: string;
  /** 작은 둘째 줄. 없으면 빈 문자열 */
  detail: string;
  href: string;
}

export const NOTICE_LABELS: Record<NoticeKind, string> = {
  lecture: "내일 강의",
  overdueFee: "미입금",
};

export interface NoticeInput {
  /** 로그인한 사람 (소문자 이메일) */
  email: string;
  isAdmin: boolean;
  today: DateString;
  /** 휴지통에 없는 과정 (진행 중 + 보관). 강의 알림은 진행 중 과정만 쓴다 */
  courses: readonly NoticeCourse[];
  /** 과정 id → 회차. 내가 담당 강사인 과정만 있어도 된다 */
  sessionsByCourse: Readonly<Record<string, readonly NoticeSession[] | undefined>>;
  /** 내가 볼 수 있는 강사료 (강사: 내 것, 관리자: 전체) */
  fees: readonly NoticeFee[];
  /** 이름 표시용. 비어 있으면 이메일로 보여 준다 */
  members: readonly NoticeMember[];
}

function lectureNotice(item: LectureItem): Notice {
  const time = item.session.startTime ? `${item.session.startTime} ` : "";
  return {
    id: `lecture:${item.course.id}:${item.session.id}`,
    kind: "lecture",
    label: NOTICE_LABELS.lecture,
    text: `내일 ${time}${courseLabel(item.course)}`,
    detail: sessionPlace(item.session),
    href: coursePath(item.course.id),
  };
}

function feeNotice(item: OverdueFeeItem, viewer: { email: string; isAdmin: boolean }, members: readonly NoticeMember[]) {
  const parts = [`입금 예정일 ${formatDateKo(item.fee.dueDate)}`, `${item.days}일 지남`];
  if (viewer.isAdmin) {
    parts.push(
      sameEmail(item.fee.instructorEmail, viewer.email) ? "내 강사료" : personLabel(item.fee.instructorEmail, members),
    );
  }
  return {
    id: `fee:${item.fee.id}`,
    kind: "overdueFee" as const,
    label: NOTICE_LABELS.overdueFee,
    text: `${feeTitle(item)} ${formatWon(item.fee.amount)}`,
    detail: parts.join(" · "),
    href: OVERDUE_FEES_PATH,
  };
}

/**
 * 로그인한 사람에게 보여 줄 알림. 내일 강의(시간 순) → 미입금 강사료(오래 밀린 순).
 * 강사는 자기 강사료만, 관리자는 모든 강사의 강사료를 본다 (강사 이름을 함께 쓴다).
 */
export function buildNotices(input: NoticeInput): Notice[] {
  const tomorrow = addDays(input.today, 1);
  const lectures = lecturesFor(input.email, lecturesOn(tomorrow, input.courses, input.sessionsByCourse));
  const visibleFees = input.isAdmin
    ? input.fees
    : input.fees.filter((fee) => sameEmail(fee.instructorEmail, input.email));
  const fees = overdueFeeItems(visibleFees, input.courses, input.today);

  return [
    ...lectures.map(lectureNotice),
    ...fees.map((item) => feeNotice(item, input, input.members)),
  ];
}

/** 종 버튼에 읽어 줄 이름 */
export function noticeCountLabel(count: number): string {
  return count > 0 ? `알림 ${count}개` : "새 알림 없음";
}

/** 배지에 쓸 숫자. 10개부터는 "9+" */
export function noticeBadgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}
