// 날짜는 "YYYY-MM-DD" 문자열(한국 시간 기준 날짜)로만 다룬다.
// 시각·시간대가 섞이지 않아 "하루 밀림" 버그가 생기지 않고, 문자열 비교로 순서를 정할 수 있다.

export type DateString = string;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 한국은 서머타임이 없어 항상 UTC+9다. */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function isDateString(value: unknown): value is DateString {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

/** "HH:MM" (24시간제) */
export function isTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function toUtcMs(date: DateString): number {
  if (!isDateString(date)) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${date}`);
  }
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): DateString {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 지금 이 순간의 한국 날짜. 테스트에서는 now를 넣어 고정한다. */
export function todayInSeoul(now: Date = new Date()): DateString {
  return fromUtcMs(now.getTime() + SEOUL_OFFSET_MS);
}

export function addDays(date: DateString, days: number): DateString {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** b - a (일 수). a가 b보다 이르면 양수 */
export function daysBetween(a: DateString, b: DateString): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** 음수: a가 이르다, 0: 같다, 양수: a가 늦다 */
export function compareDates(a: DateString, b: DateString): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 0=일 … 6=토 */
export function weekdayOf(date: DateString): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

export interface DateRange {
  start: DateString;
  end: DateString;
}

/** 월요일~일요일 한 주. 일요일이면 그 앞 월요일부터다. */
export function weekRange(today: DateString): DateRange {
  const weekday = weekdayOf(today);
  const daysSinceMonday = (weekday + 6) % 7;
  const start = addDays(today, -daysSinceMonday);
  return { start, end: addDays(start, 6) };
}

/** start와 end를 모두 포함한다 */
export function isWithinRange(date: DateString, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** "10월 11일 (토)" — withYear면 "2026년 10월 11일 (토)" */
export function formatDateKo(
  date: DateString,
  options: { withYear?: boolean; withWeekday?: boolean } = {},
): string {
  const { withYear = false, withWeekday = true } = options;
  const [year, month, day] = date.split("-").map(Number);
  const base = `${month}월 ${day}일`;
  const withYearText = withYear ? `${year}년 ${base}` : base;
  if (!withWeekday) return withYearText;
  return `${withYearText} (${WEEKDAY_LABELS[weekdayOf(date)]})`;
}

/** "오늘", "내일", "어제", "3일 후", "2일 지남" */
export function relativeDayLabel(date: DateString, today: DateString): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff > 0) return `${diff}일 후`;
  return `${-diff}일 지남`;
}

export type DueStatus = "overdue" | "today" | "soon" | "later";

/** 마감일 상태. soonDays일 이내(내일~)면 soon */
export function dueStatus(
  dueDate: DateString,
  today: DateString,
  soonDays = 3,
): DueStatus {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= soonDays) return "soon";
  return "later";
}
