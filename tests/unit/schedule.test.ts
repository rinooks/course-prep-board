import { describe, expect, it } from "vitest";
import {
  dueSoonCards,
  isSessionSoon,
  nextSession,
  sessionsInRange,
  sortCoursesByNextSession,
  sortSessions,
  upcomingSessions,
} from "@/lib/domain/schedule";
import { weekRange } from "@/lib/domain/dates";
import { makeCard, makeSession } from "./fixtures";

const today = "2026-10-11";

describe("회차", () => {
  const sessions = [
    makeSession({ id: "past", date: "2026-10-01" }),
    makeSession({ id: "todayLate", date: today, startTime: "14:00" }),
    makeSession({ id: "todayEarly", date: today, startTime: "09:00" }),
    makeSession({ id: "todayNoTime", date: today }),
    makeSession({ id: "later", date: "2026-10-20" }),
  ];

  it("날짜·시작 시간 순 정렬 (시간 없는 회차는 그날 마지막)", () => {
    expect(sortSessions(sessions).map((s) => s.id)).toEqual([
      "past",
      "todayEarly",
      "todayLate",
      "todayNoTime",
      "later",
    ]);
  });

  it("오늘 포함 앞으로의 회차와 다음 회차", () => {
    expect(upcomingSessions(sessions, today).map((s) => s.id)).toEqual([
      "todayEarly",
      "todayLate",
      "todayNoTime",
      "later",
    ]);
    expect(nextSession(sessions, today)?.id).toBe("todayEarly");
    expect(nextSession(sessions, "2026-11-01")).toBeNull();
  });

  it("이번 주 회차", () => {
    // 2026-10-11(일)의 주: 10-05 ~ 10-11
    expect(sessionsInRange(sessions, weekRange(today)).map((s) => s.id)).toEqual([
      "todayEarly",
      "todayLate",
      "todayNoTime",
    ]);
  });
});

describe("isSessionSoon", () => {
  it("오늘부터 3일 뒤까지만 곧 열리는 강의로 본다", () => {
    expect(isSessionSoon("2026-10-11", today)).toBe(true);
    expect(isSessionSoon("2026-10-14", today)).toBe(true);
    expect(isSessionSoon("2026-10-15", today)).toBe(false);
    expect(isSessionSoon("2026-10-10", today)).toBe(false);
  });
});

describe("dueSoonCards", () => {
  it("안 끝났고 휴지통이 아니고 기한 안(지난 것 포함)인 카드를 마감일 순으로", () => {
    const cards = [
      makeCard({ id: "overdue", dueDate: "2026-10-01" }),
      makeCard({ id: "soon", dueDate: "2026-10-15" }),
      makeCard({ id: "far", dueDate: "2026-12-01" }),
      makeCard({ id: "done", dueDate: "2026-10-12", done: true }),
      makeCard({ id: "trashed", dueDate: "2026-10-12", deletedAt: 1 }),
      makeCard({ id: "noDue", dueDate: null }),
      makeCard({ id: "today", dueDate: today }),
    ];
    expect(dueSoonCards(cards, today).map((card) => card.id)).toEqual(["overdue", "today", "soon"]);
    expect(dueSoonCards(cards, today, 0).map((card) => card.id)).toEqual(["overdue", "today"]);
  });
});

describe("sortCoursesByNextSession", () => {
  it("다음 강의가 가까운 순, 일정 없는 과정은 뒤에 이름순", () => {
    const courses = [
      { id: "c1", title: "나 과정" },
      { id: "c2", title: "가 과정" },
      { id: "c3", title: "다 과정" },
      { id: "c4", title: "라 과정" },
    ];
    const sorted = sortCoursesByNextSession(courses, {
      c3: "2026-10-20",
      c4: "2026-10-12",
      c1: null,
    });
    expect(sorted.map((course) => course.id)).toEqual(["c4", "c3", "c2", "c1"]);
  });
});
