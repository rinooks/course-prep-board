// 캘린더 날짜 계산: 달·주 범위, 달력 칸, 앞뒤로 넘기기. 순수 함수.
// 한 주는 weekRange와 같이 월요일에 시작한다.

import { addDays, weekRange, type DateRange, type DateString } from "./dates";

export type CalendarView = "month" | "week";

/** 그 날짜가 속한 달의 1일 */
export function monthStartOf(date: DateString): DateString {
  return `${date.slice(0, 7)}-01`;
}

/** 달의 1일에서 months달 앞(음수면 뒤)의 1일 */
export function addMonths(monthStart: DateString, months: number): DateString {
  const [year, month] = monthStart.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
}

/** 달의 마지막 날 */
export function monthEndOf(monthStart: DateString): DateString {
  return addDays(addMonths(monthStart, 1), -1);
}

/** 달력에 그릴 범위: 1일이 든 주의 월요일 ~ 마지막 날이 든 주의 일요일 (4~6주) */
export function monthGridRange(monthStart: DateString): DateRange {
  return {
    start: weekRange(monthStart).start,
    end: weekRange(monthEndOf(monthStart)).end,
  };
}

/** 범위 안의 모든 날짜 (양 끝 포함, 날짜 순) */
export function datesInRange(range: DateRange): DateString[] {
  const dates: DateString[] = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** 날짜 목록을 7일씩 끊는다 (달력의 한 줄 = 한 주) */
export function chunkWeeks(dates: readonly DateString[]): DateString[][] {
  const weeks: DateString[][] = [];
  for (let index = 0; index < dates.length; index += 7) {
    weeks.push(dates.slice(index, index + 7));
  }
  return weeks;
}

/** 보기(달·주)와 기준 날짜로 화면에 그릴 범위 */
export function visibleRange(view: CalendarView, anchor: DateString): DateRange {
  return view === "month" ? monthGridRange(monthStartOf(anchor)) : weekRange(anchor);
}

/** 이전·다음 버튼: 달 보기는 한 달, 주 보기는 7일씩 옮긴다 */
export function shiftAnchor(view: CalendarView, anchor: DateString, step: 1 | -1): DateString {
  return view === "month" ? addMonths(monthStartOf(anchor), step) : addDays(anchor, 7 * step);
}

/** "2026년 10월" */
export function formatMonthKo(date: DateString): string {
  const [year, month] = date.split("-").map(Number);
  return `${year}년 ${month}월`;
}
