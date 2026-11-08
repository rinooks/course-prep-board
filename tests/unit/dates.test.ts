import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  compareDates,
  daysBetween,
  dueStatus,
  formatDateKo,
  isDateString,
  isTimeString,
  isWithinRange,
  relativeDayLabel,
  todayInSeoul,
  weekRange,
  weekdayOf,
} from "@/lib/domain/dates";

describe("todayInSeoul", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("UTC 15:00 이후는 한국에서 다음 날이다", () => {
    expect(todayInSeoul(new Date("2026-10-11T14:59:59Z"))).toBe("2026-10-11");
    expect(todayInSeoul(new Date("2026-10-11T15:00:00Z"))).toBe("2026-10-12");
  });

  it("인자가 없으면 지금 시각(가짜 시계)을 쓴다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T16:00:00Z"));
    expect(todayInSeoul()).toBe("2027-01-01");
  });
});

describe("날짜 형식 검사", () => {
  it("실제로 있는 날짜만 통과한다", () => {
    expect(isDateString("2026-02-28")).toBe(true);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026-1-01")).toBe(false);
    expect(isDateString(20260101)).toBe(false);
  });

  it("시간은 HH:MM 24시간제", () => {
    expect(isTimeString("09:30")).toBe(true);
    expect(isTimeString("23:59")).toBe(true);
    expect(isTimeString("24:00")).toBe(false);
    expect(isTimeString("9:30")).toBe(false);
  });
});

describe("날짜 계산", () => {
  it("addDays는 달·해를 넘긴다", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("daysBetween과 compareDates", () => {
    expect(daysBetween("2026-10-11", "2026-10-14")).toBe(3);
    expect(daysBetween("2026-10-14", "2026-10-11")).toBe(-3);
    expect(compareDates("2026-10-11", "2026-10-12")).toBe(-1);
    expect(compareDates("2026-10-12", "2026-10-12")).toBe(0);
    expect(compareDates("2026-11-01", "2026-10-31")).toBe(1);
  });

  it("weekdayOf: 2026-10-11은 일요일", () => {
    expect(weekdayOf("2026-10-11")).toBe(0);
    expect(weekdayOf("2026-10-12")).toBe(1);
  });
});

describe("weekRange (월~일)", () => {
  it("일요일이면 앞 월요일부터 그 일요일까지", () => {
    expect(weekRange("2026-10-11")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
  });

  it("월요일이면 그날부터", () => {
    expect(weekRange("2026-10-12")).toEqual({ start: "2026-10-12", end: "2026-10-18" });
  });

  it("주가 해를 넘겨도 맞다", () => {
    expect(weekRange("2026-12-31")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("isWithinRange는 양 끝을 포함한다", () => {
    const range = { start: "2026-10-05", end: "2026-10-11" };
    expect(isWithinRange("2026-10-05", range)).toBe(true);
    expect(isWithinRange("2026-10-11", range)).toBe(true);
    expect(isWithinRange("2026-10-12", range)).toBe(false);
  });
});

describe("표시용 문구", () => {
  it("formatDateKo", () => {
    expect(formatDateKo("2026-10-11")).toBe("10월 11일 (일)");
    expect(formatDateKo("2026-10-11", { withYear: true })).toBe("2026년 10월 11일 (일)");
    expect(formatDateKo("2026-10-11", { withWeekday: false })).toBe("10월 11일");
  });

  it("relativeDayLabel", () => {
    expect(relativeDayLabel("2026-10-11", "2026-10-11")).toBe("오늘");
    expect(relativeDayLabel("2026-10-12", "2026-10-11")).toBe("내일");
    expect(relativeDayLabel("2026-10-10", "2026-10-11")).toBe("어제");
    expect(relativeDayLabel("2026-10-14", "2026-10-11")).toBe("3일 후");
    expect(relativeDayLabel("2026-10-09", "2026-10-11")).toBe("2일 지남");
  });

  it("dueStatus", () => {
    const today = "2026-10-11";
    expect(dueStatus("2026-10-10", today)).toBe("overdue");
    expect(dueStatus("2026-10-11", today)).toBe("today");
    expect(dueStatus("2026-10-14", today)).toBe("soon");
    expect(dueStatus("2026-10-15", today)).toBe("later");
    expect(dueStatus("2026-10-15", today, 7)).toBe("soon");
  });
});
