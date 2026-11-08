// 강사료 화면 표시 문구와 걸러 보기 (순수 함수, tests/unit/fee-display.test.ts가 검사한다).
// 과정 탭(/courses/[id]/fees)과 강사료 화면(/fees)이 같이 쓴다.

import type { BadgeTone } from "@/components/ui/Badge";
import type { Fee, Session } from "@/lib/data/types";
import { formatDateKo, isDateString, type DateString } from "@/lib/domain/dates";
import { FEE_STATUS_LABELS, feeStatus, overdueDays, type FeeLike, type FeeStatus } from "@/lib/domain/fees";

/** 항목 이름을 비워 두었을 때 보여 줄 이름 */
export const DEFAULT_FEE_TITLE = "강사료";

const BROKEN_DATE = "날짜 확인 필요";

/** 목록·확인 창에 보여 줄 이름: 항목 이름, 없으면 "강사료" */
export function feeTitle(fee: Pick<Fee, "label">): string {
  const label = fee.label.trim();
  return label.length > 0 ? label : DEFAULT_FEE_TITLE;
}

export interface FeeBadge {
  status: FeeStatus;
  text: string;
  tone: BadgeTone;
}

const STATUS_TONES: Record<FeeStatus, BadgeTone> = {
  overdue: "danger",
  upcoming: "neutral",
  paid: "success",
};

/**
 * 상태 배지: "미입금 · 12일 지남"(빨강), "받을 예정"(회색), "입금됨"(초록).
 * 색만으로 구분하지 않도록 글자에 상태를 함께 적는다.
 * 저장된 예정일이 이상하면(직접 고친 데이터 등) 날 수를 세지 않는다 (화면이 멈추지 않게).
 */
export function feeBadge(fee: Pick<FeeLike, "dueDate" | "paidDate">, today: DateString): FeeBadge {
  const status = feeStatus(fee, today);
  const base = FEE_STATUS_LABELS[status];
  if (status === "overdue" && isDateString(fee.dueDate) && isDateString(today)) {
    const days = overdueDays(fee, today);
    return { status, text: `${base} · ${days}일 지남`, tone: STATUS_TONES[status] };
  }
  return { status, text: base, tone: STATUS_TONES[status] };
}

/** "10월 30일 (금)" — 올해가 아니면 연도도 붙인다. 날짜가 이상하면 "날짜 확인 필요" */
export function feeDateLabel(date: string, today: DateString): string {
  if (!isDateString(date)) return BROKEN_DATE;
  const withYear = date.slice(0, 4) !== today.slice(0, 4);
  return formatDateKo(date, { withYear });
}

/** 날짜 줄: "입금 예정 10월 30일 (금)" 또는 "입금 10월 20일 (화) · 예정 10월 30일 (금)" */
export function feeDatesText(fee: Pick<FeeLike, "dueDate" | "paidDate">, today: DateString): string {
  const due = feeDateLabel(fee.dueDate, today);
  if (fee.paidDate === null) return `입금 예정 ${due}`;
  return `입금 ${feeDateLabel(fee.paidDate, today)} · 예정 ${due}`;
}

// ---------- 걸러 보기 (/fees) ----------

export type FeeFilter = "all" | FeeStatus;

export const FEE_FILTERS: readonly FeeFilter[] = ["all", "overdue", "upcoming", "paid"];

export const FEE_FILTER_LABELS: Record<FeeFilter, string> = {
  all: "전체",
  overdue: FEE_STATUS_LABELS.overdue,
  upcoming: FEE_STATUS_LABELS.upcoming,
  paid: FEE_STATUS_LABELS.paid,
};

/** 주소의 ?status= 값 읽기. 모르는 값이면 전체 */
export function parseFeeFilter(raw: string | null | undefined): FeeFilter {
  return FEE_FILTERS.find((filter) => filter === raw) ?? "all";
}

/** 관리자의 보기 범위: 팀 전체 / 내 것만 */
export type FeeScopeView = "team" | "mine";

/** 주소의 ?scope= 값 읽기. mine이 아니면 팀 전체 */
export function parseFeeScope(raw: string | null | undefined): FeeScopeView {
  return raw === "mine" ? "mine" : "team";
}

/** 강사료 화면 주소. 기본값(전체·팀 전체)은 주소에 적지 않는다 */
export function feesHref(filter: FeeFilter, scope: FeeScopeView): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (scope !== "team") params.set("scope", scope);
  const query = params.toString();
  return query.length > 0 ? `/fees?${query}` : "/fees";
}

/** 상태로 거르기. 순서는 그대로 둔다 */
export function filterFees<T extends FeeLike>(fees: readonly T[], filter: FeeFilter, today: DateString): T[] {
  if (filter === "all") return [...fees];
  return fees.filter((fee) => feeStatus(fee, today) === filter);
}

/** 상태별 건수 (걸러 보기 버튼 옆 숫자) */
export function countFeesByFilter(fees: readonly FeeLike[], today: DateString): Record<FeeFilter, number> {
  const counts: Record<FeeFilter, number> = { all: fees.length, overdue: 0, upcoming: 0, paid: 0 };
  for (const fee of fees) counts[feeStatus(fee, today)] += 1;
  return counts;
}

// ---------- 강사료 추가 창의 기본값 ----------

/** 과정의 마지막 강의 날. 회차가 없거나 날짜가 모두 이상하면 null */
export function lastSessionDate(sessions: readonly Pick<Session, "date">[]): DateString | null {
  let last: DateString | null = null;
  for (const session of sessions) {
    if (!isDateString(session.date)) continue;
    if (last === null || session.date > last) last = session.date;
  }
  return last;
}

export interface InstructorChoice {
  email: string;
  /** 이 과정의 담당 강사인지 (선택지에 "담당 강사"로 표시) */
  isCourseInstructor: boolean;
}

/**
 * 관리자가 강사료를 받을 강사를 고르는 선택지: 과정 담당 강사 먼저, 그다음 나머지 팀원.
 * 보안 규칙은 팀원에게만 강사료를 만들 수 있게 하므로, 팀원 목록을 받았으면 팀원이 아닌 담당 강사는 뺀다.
 * 팀원 목록을 아직 못 받았으면(null) 담당 강사와 나만 보여 준다.
 */
export function instructorChoices(
  courseInstructors: readonly string[],
  memberEmails: readonly string[] | null,
  me: string,
): InstructorChoice[] {
  const seen = new Set<string>();
  const choices: InstructorChoice[] = [];
  const memberSet = memberEmails === null ? null : new Set(memberEmails);
  const add = (email: string, isCourseInstructor: boolean) => {
    if (email.length === 0 || seen.has(email)) return;
    seen.add(email);
    choices.push({ email, isCourseInstructor });
  };

  for (const email of courseInstructors) {
    if (memberSet === null || memberSet.has(email) || email === me) add(email, true);
  }
  if (memberEmails === null) {
    add(me, false);
  } else {
    for (const email of memberEmails) add(email, false);
  }
  return choices;
}

/**
 * 강사료를 받을 강사의 처음 값.
 * - 강사: 언제나 나
 * - 관리자: 내가 담당 강사면 나, 담당 강사가 한 명뿐이면 그 사람, 아니면 빈 값(직접 고르게 한다)
 */
export function defaultInstructor(
  choices: readonly InstructorChoice[],
  me: string,
  isAdmin: boolean,
): string {
  if (!isAdmin) return me;
  const courseInstructors = choices.filter((choice) => choice.isCourseInstructor);
  if (courseInstructors.some((choice) => choice.email === me)) return me;
  if (courseInstructors.length === 1) return courseInstructors[0].email;
  return "";
}
