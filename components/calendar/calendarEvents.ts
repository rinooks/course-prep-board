// 캘린더에 올릴 일정 모으기: 강의 회차, 리허설·회의 같은 준비 일정, 안 끝난 카드의 마감일.
// 화면 코드와 분리한 순수 함수라 tests/unit/calendar.test.ts에서 검사한다.

import type { CourseDetail } from "@/lib/data/overview";
import type { Course } from "@/lib/data/types";
import { isDateString, isWithinRange, type DateRange, type DateString } from "@/lib/domain/dates";
import type { EventKind } from "@/lib/domain/events";
import type { StageId } from "@/lib/domain/stages";

export interface SessionEvent {
  kind: "session";
  date: DateString;
  courseId: string;
  courseTitle: string;
  sessionId: string;
  startTime: string | null;
  location: string;
  audience: string;
}

/** 리허설·회의 같은 준비 일정 (과정 보드의 "준비 일정"에서 넣는다) */
export interface PrepEvent {
  kind: "event";
  date: DateString;
  courseId: string;
  courseTitle: string;
  eventId: string;
  eventKind: EventKind;
  title: string;
  startTime: string | null;
  note: string;
}

export interface DueEvent {
  kind: "due";
  date: DateString;
  courseId: string;
  courseTitle: string;
  cardId: string;
  cardTitle: string;
  stage: StageId;
}

export type CalendarEvent = SessionEvent | PrepEvent | DueEvent;

export interface CalendarEventsOptions {
  /** 이 과정의 일정만 (null이면 전체) */
  courseId?: string | null;
}

/** 같은 날 안에서 종류별 순서: 강의 → 리허설·회의 → 마감 카드 */
const KIND_ORDER: Record<CalendarEvent["kind"], number> = {
  session: 0,
  event: 1,
  due: 2,
};

/** 시간 없는 일정은 그날 시간 있는 일정 뒤로 */
const NO_TIME = "99:99";

/**
 * 같은 날 안의 순서: 종류(KIND_ORDER) → 같은 종류 안에서는
 * - 강의: 시작 시간 → 과정 이름
 * - 리허설·회의: 시작 시간 → 과정 이름 → 일정 이름
 * - 마감 카드: 과정 이름 → 카드 이름
 */
function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.kind === "due" && b.kind === "due") {
    const byCourse = a.courseTitle.localeCompare(b.courseTitle, "ko");
    if (byCourse !== 0) return byCourse;
    return a.cardTitle.localeCompare(b.cardTitle, "ko");
  }
  if (a.kind === "due" || b.kind === "due") return 0;

  const timeA = a.startTime ?? NO_TIME;
  const timeB = b.startTime ?? NO_TIME;
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  const byCourse = a.courseTitle.localeCompare(b.courseTitle, "ko");
  if (byCourse !== 0) return byCourse;
  if (a.kind === "event" && b.kind === "event") return a.title.localeCompare(b.title, "ko");
  return 0;
}

/**
 * range 안의 일정을 날짜별로 모은다. 키는 날짜, 값은 그날 일정(정렬됨). 일정 없는 날은 키가 없다.
 * - 강의: 모든 회차
 * - 리허설·회의: 모든 준비 일정
 * - 마감: 안 끝났고 휴지통에 없는 카드
 * - courses에 없는 과정(보관 등)과 날짜 형식이 이상한 값은 넣지 않는다
 */
export function buildCalendarEvents(
  courses: readonly Course[],
  details: Readonly<Record<string, CourseDetail>>,
  range: DateRange,
  options: CalendarEventsOptions = {},
): Map<DateString, CalendarEvent[]> {
  const byDate = new Map<DateString, CalendarEvent[]>();
  const add = (event: CalendarEvent) => {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  };

  for (const course of courses) {
    if (options.courseId && course.id !== options.courseId) continue;
    const detail = details[course.id];
    if (!detail) continue;

    for (const session of detail.sessions) {
      if (!isDateString(session.date) || !isWithinRange(session.date, range)) continue;
      add({
        kind: "session",
        date: session.date,
        courseId: course.id,
        courseTitle: course.title,
        sessionId: session.id,
        startTime: session.startTime,
        location: session.location,
        audience: session.audience,
      });
    }

    // 예전 데이터처럼 events가 없는 묶음이 와도 캘린더 전체가 멈추지 않게 빈 목록으로 본다
    for (const prep of detail.events ?? []) {
      if (!isDateString(prep.date) || !isWithinRange(prep.date, range)) continue;
      add({
        kind: "event",
        date: prep.date,
        courseId: course.id,
        courseTitle: course.title,
        eventId: prep.id,
        eventKind: prep.kind,
        title: prep.title,
        startTime: prep.startTime,
        note: prep.note,
      });
    }

    for (const card of detail.cards) {
      if (card.done || card.deletedAt !== null || card.dueDate === null) continue;
      if (!isDateString(card.dueDate) || !isWithinRange(card.dueDate, range)) continue;
      add({
        kind: "due",
        date: card.dueDate,
        courseId: course.id,
        courseTitle: course.title,
        cardId: card.id,
        cardTitle: card.title,
        stage: card.stage,
      });
    }
  }

  for (const list of byDate.values()) list.sort(compareEvents);
  return byDate;
}

export interface EventCounts {
  sessions: number;
  /** 리허설·회의 */
  events: number;
  dues: number;
}

/** 일정 수 세기 (화면 위 요약 문구용) */
export function countEvents(byDate: ReadonlyMap<DateString, readonly CalendarEvent[]>): EventCounts {
  const counts: EventCounts = { sessions: 0, events: 0, dues: 0 };
  for (const list of byDate.values()) {
    for (const event of list) {
      if (event.kind === "session") counts.sessions += 1;
      else if (event.kind === "event") counts.events += 1;
      else counts.dues += 1;
    }
  }
  return counts;
}

/** 일정을 눌렀을 때 갈 주소: 강의·리허설·회의는 과정 보드, 마감 카드는 그 카드가 열린 보드 */
export function eventHref(event: CalendarEvent): string {
  if (event.kind === "due") return `/courses/${event.courseId}?card=${encodeURIComponent(event.cardId)}`;
  return `/courses/${event.courseId}`;
}

/** 목록에서 쓸 고유 키 (React key). 종류마다 id 공간이 달라 앞 글자로 나눈다 */
export function eventKey(event: CalendarEvent): string {
  if (event.kind === "session") return `s-${event.courseId}-${event.sessionId}`;
  if (event.kind === "event") return `e-${event.courseId}-${event.eventId}`;
  return `d-${event.courseId}-${event.cardId}`;
}
