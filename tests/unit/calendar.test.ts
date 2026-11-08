import { describe, expect, it } from "vitest";
import {
  buildCalendarEvents,
  countEvents,
  eventHref,
  eventKey,
  type CalendarEvent,
} from "@/components/calendar/calendarEvents";
import type { CourseDetail } from "@/lib/data/overview";
import type { Course } from "@/lib/data/types";
import {
  addMonths,
  chunkWeeks,
  datesInRange,
  formatMonthKo,
  monthEndOf,
  monthGridRange,
  monthStartOf,
  shiftAnchor,
  visibleRange,
} from "@/lib/domain/calendar";
import { makeCard, makeEvent, makeSession } from "./fixtures";

describe("달 계산", () => {
  it("달의 1일·마지막 날", () => {
    expect(monthStartOf("2026-10-12")).toBe("2026-10-01");
    expect(monthEndOf("2026-10-01")).toBe("2026-10-31");
    expect(monthEndOf("2028-02-01")).toBe("2028-02-29");
  });

  it("달 넘기기는 해를 넘어간다", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", -14)).toBe("2025-08-01");
  });

  it("달력 범위는 월요일~일요일로 맞춘다", () => {
    // 2026-10-01은 목요일, 10-31은 토요일
    expect(monthGridRange("2026-10-01")).toEqual({ start: "2026-09-28", end: "2026-11-01" });
    const dates = datesInRange(monthGridRange("2026-10-01"));
    expect(dates).toHaveLength(35);
    expect(chunkWeeks(dates)).toHaveLength(5);
  });

  it("1일이 월요일이면 그날부터 시작한다", () => {
    // 2026-06-01은 월요일
    expect(monthGridRange("2026-06-01").start).toBe("2026-06-01");
  });

  it("보기별 범위와 앞뒤 이동", () => {
    expect(visibleRange("week", "2026-10-11")).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(visibleRange("month", "2026-10-11").start).toBe("2026-09-28");
    expect(shiftAnchor("week", "2026-10-11", 1)).toBe("2026-10-18");
    expect(shiftAnchor("month", "2026-10-11", -1)).toBe("2026-09-01");
  });

  it("달 이름", () => {
    expect(formatMonthKo("2026-10-01")).toBe("2026년 10월");
  });
});

function makeCourse(id: string, title: string): Course {
  return {
    id,
    title,
    client: "",
    description: "",
    instructorEmails: [],
    status: "active",
    deletedAt: null,
    deletedBy: null,
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
  };
}

describe("buildCalendarEvents", () => {
  const courseA = makeCourse("a", "가 과정");
  const courseB = makeCourse("b", "나 과정");
  const details: Record<string, CourseDetail> = {
    a: {
      loaded: true,
      sessions: [
        makeSession({ id: "a-late", courseId: "a", date: "2026-10-12", startTime: "14:00" }),
        makeSession({ id: "a-out", courseId: "a", date: "2026-11-20" }),
      ],
      events: [
        makeEvent({ id: "a-meet", courseId: "a", kind: "meeting", title: "고객사 회의", date: "2026-10-12" }),
        makeEvent({ id: "a-rehearsal", courseId: "a", title: "최종 리허설", date: "2026-10-12", startTime: "10:00" }),
        makeEvent({ id: "a-ev-out", courseId: "a", date: "2026-11-02" }),
      ],
      cards: [
        makeCard({ id: "a-due", courseId: "a", title: "교안 검토", dueDate: "2026-10-12" }),
        makeCard({ id: "a-done", courseId: "a", dueDate: "2026-10-12", done: true }),
        makeCard({ id: "a-trash", courseId: "a", dueDate: "2026-10-12", deletedAt: 1 }),
        makeCard({ id: "a-nodate", courseId: "a" }),
      ],
    },
    b: {
      loaded: true,
      sessions: [makeSession({ id: "b-early", courseId: "b", date: "2026-10-12", startTime: "09:00" })],
      events: [makeEvent({ id: "b-meet", courseId: "b", kind: "meeting", title: "사전 점검", date: "2026-10-14", startTime: "15:00" })],
      cards: [makeCard({ id: "b-due", courseId: "b", title: "장소 확인", dueDate: "2026-10-14" })],
    },
    archived: {
      loaded: true,
      sessions: [makeSession({ id: "x", courseId: "archived", date: "2026-10-12" })],
      events: [makeEvent({ id: "x-ev", courseId: "archived", date: "2026-10-12" })],
      cards: [],
    },
  };
  const range = { start: "2026-10-01", end: "2026-10-31" };

  /** 종류와 상관없이 일정의 id만 꺼낸다 (순서 비교용) */
  function idOf(event: CalendarEvent): string {
    if (event.kind === "session") return event.sessionId;
    if (event.kind === "event") return event.eventId;
    return event.cardId;
  }

  it("범위 안의 강의·리허설·회의와 안 끝난 카드 마감만, 날짜별로 정렬해 모은다", () => {
    const events = buildCalendarEvents([courseA, courseB], details, range);
    expect([...events.keys()].sort()).toEqual(["2026-10-12", "2026-10-14"]);
    const day = events.get("2026-10-12") ?? [];
    // 강의(시간 순) → 리허설·회의(시간 순, 시간 없는 일정은 뒤) → 마감 카드
    expect(day.map(idOf)).toEqual(["b-early", "a-late", "a-rehearsal", "a-meet", "a-due"]);
    expect(countEvents(events)).toEqual({ sessions: 2, events: 3, dues: 2 });
  });

  it("리허설·회의는 종류·이름·시간·메모를 그대로 싣는다", () => {
    const events = buildCalendarEvents([courseA], details, range);
    const rehearsal = (events.get("2026-10-12") ?? []).find((event) => event.kind === "event");
    expect(rehearsal).toEqual({
      kind: "event",
      date: "2026-10-12",
      courseId: "a",
      courseTitle: "가 과정",
      eventId: "a-rehearsal",
      eventKind: "rehearsal",
      title: "최종 리허설",
      startTime: "10:00",
      note: "",
    });
  });

  it("같은 날 리허설·회의끼리는 시간이 같으면 과정 이름 순", () => {
    const sameDay: Record<string, CourseDetail> = {
      a: {
        loaded: true,
        sessions: [],
        cards: [],
        events: [makeEvent({ id: "a-ev", courseId: "a", date: "2026-10-20", startTime: "13:00" })],
      },
      b: {
        loaded: true,
        sessions: [],
        cards: [],
        events: [makeEvent({ id: "b-ev", courseId: "b", date: "2026-10-20", startTime: "13:00" })],
      },
    };
    // 목록 순서를 일부러 뒤집어도 과정 이름(가 → 나) 순으로 나온다
    const events = buildCalendarEvents([courseB, courseA], sameDay, range);
    expect((events.get("2026-10-20") ?? []).map(idOf)).toEqual(["a-ev", "b-ev"]);
  });

  it("날짜 형식이 이상한 일정은 넣지 않는다", () => {
    const broken: Record<string, CourseDetail> = {
      a: {
        loaded: true,
        sessions: [],
        cards: [],
        events: [makeEvent({ id: "bad", courseId: "a", date: "2026-13-40" })],
      },
    };
    expect(buildCalendarEvents([courseA], broken, range).size).toBe(0);
  });

  it("과정을 고르면 그 과정 일정만", () => {
    const events = buildCalendarEvents([courseA, courseB], details, range, { courseId: "b" });
    expect(countEvents(events)).toEqual({ sessions: 1, events: 1, dues: 1 });
    expect((events.get("2026-10-14") ?? []).map(idOf)).toEqual(["b-meet", "b-due"]);
  });

  it("목록에 없는 과정(보관 등)은 넣지 않는다", () => {
    const events = buildCalendarEvents([courseA], details, range);
    const ids = [...events.values()].flat().map((event) => event.courseId);
    expect(ids.every((id) => id === "a")).toBe(true);
  });

  it("눌렀을 때 갈 주소: 강의·리허설·회의는 과정 보드, 마감 카드는 그 카드", () => {
    const events = buildCalendarEvents([courseA], details, range);
    const [session, rehearsal, meeting, due] = events.get("2026-10-12") ?? [];
    expect(eventHref(session)).toBe("/courses/a");
    expect(eventHref(rehearsal)).toBe("/courses/a");
    expect(eventHref(meeting)).toBe("/courses/a");
    expect(eventHref(due)).toBe("/courses/a?card=a-due");
  });

  it("목록 키는 종류가 달라도 겹치지 않는다", () => {
    const events = buildCalendarEvents([courseA, courseB], details, range);
    const keys = [...events.values()].flat().map(eventKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("e-a-a-rehearsal");
  });
});
