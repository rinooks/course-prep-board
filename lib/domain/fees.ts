// 강사료 입금 관리: 상태(받을 예정·밀림·입금됨), 합계, 미입금 알림 날짜, 금액 표시.
// 강사료는 강사 본인이 받는 돈이다. 금액은 원 단위 정수(세금을 뺀 실제 입금액 기준을 권한다).

import { addDays, compareDates, daysBetween, type DateString } from "./dates";

/** 한 건 최대 금액 (10억 원). 잘못 친 숫자를 막는 용도 */
export const FEE_AMOUNT_MAX = 1_000_000_000;

/** 입금 예정일 기본값: 마지막 강의 날(없으면 오늘)부터 30일 뒤 (가정) */
export const DEFAULT_DUE_DAYS = 30;

/** 밀린 강사료 메일: 예정일 다음 날 처음 보내고, 그 뒤 이 간격(일)마다 다시 보낸다 */
export const OVERDUE_REMIND_INTERVAL_DAYS = 7;

export type FeeStatus = "upcoming" | "overdue" | "paid";

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  upcoming: "받을 예정",
  overdue: "미입금",
  paid: "입금됨",
};

export interface FeeLike {
  id: string;
  amount: number;
  dueDate: DateString;
  /** 입금일. null이면 아직 입금 전 */
  paidDate: DateString | null;
}

/** 입금됐으면 paid, 예정일이 지났는데 입금 전이면 overdue, 그 밖은 upcoming (예정일 당일은 아직 upcoming) */
export function feeStatus(fee: Pick<FeeLike, "dueDate" | "paidDate">, today: DateString): FeeStatus {
  if (fee.paidDate !== null) return "paid";
  return compareDates(fee.dueDate, today) < 0 ? "overdue" : "upcoming";
}

/** 예정일에서 며칠 지났는지. 아직 안 지났거나 입금됐으면 0 */
export function overdueDays(fee: Pick<FeeLike, "dueDate" | "paidDate">, today: DateString): number {
  if (feeStatus(fee, today) !== "overdue") return 0;
  return daysBetween(fee.dueDate, today);
}

/** 오늘 미입금 알림 메일을 보낼 날인지: 예정일 다음 날, 그 뒤 7일마다 (1, 8, 15…일째) */
export function shouldRemindOverdue(fee: Pick<FeeLike, "dueDate" | "paidDate">, today: DateString): boolean {
  const days = overdueDays(fee, today);
  return days >= 1 && (days - 1) % OVERDUE_REMIND_INTERVAL_DAYS === 0;
}

export interface FeeTotals {
  count: number;
  amount: number;
}

export interface FeeSummary {
  upcoming: FeeTotals;
  overdue: FeeTotals;
  paid: FeeTotals;
}

/** 상태별 건수와 금액 합계 */
export function summarizeFees(fees: readonly FeeLike[], today: DateString): FeeSummary {
  const summary: FeeSummary = {
    upcoming: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
  };
  for (const fee of fees) {
    const bucket = summary[feeStatus(fee, today)];
    bucket.count += 1;
    bucket.amount += fee.amount;
  }
  return summary;
}

const STATUS_ORDER: Record<FeeStatus, number> = { overdue: 0, upcoming: 1, paid: 2 };

/** 보여 줄 순서: 미입금(오래 밀린 순) → 받을 예정(예정일 순) → 입금됨(최근 입금 순) */
export function sortFees<T extends FeeLike>(fees: readonly T[], today: DateString): T[] {
  return [...fees].sort((a, b) => {
    const statusA = feeStatus(a, today);
    const statusB = feeStatus(b, today);
    if (statusA !== statusB) return STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
    if (statusA === "paid") {
      const byPaid = compareDates(b.paidDate as DateString, a.paidDate as DateString);
      if (byPaid !== 0) return byPaid;
    } else {
      const byDue = compareDates(a.dueDate, b.dueDate);
      if (byDue !== 0) return byDue;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 입금 예정일 기본값: 마지막 강의 날(없으면 오늘) + 30일 */
export function suggestDueDate(lastSessionDate: DateString | null, today: DateString): DateString {
  return addDays(lastSessionDate ?? today, DEFAULT_DUE_DAYS);
}

const WON_FORMAT = new Intl.NumberFormat("ko-KR");

/** 1200000 → "1,200,000원" */
export function formatWon(amount: number): string {
  return `${WON_FORMAT.format(amount)}원`;
}

/** 금액 칸에 보여 줄 값: 1200000 → "1,200,000" */
export function formatAmountInput(amount: number): string {
  return WON_FORMAT.format(amount);
}

/**
 * 금액 칸 입력 읽기: "1,200,000원", " 1200000 " → 1200000.
 * 숫자가 아니거나 소수·음수면 null (검사에서 안내 문구를 붙인다).
 */
export function parseWon(raw: string): number | null {
  const cleaned = raw.normalize("NFKC").replace(/[\s,원₩]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}
