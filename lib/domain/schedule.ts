// 일정 계산: 다음 회차, 이번 주 회차, 마감이 다가온 카드, 홈 정렬.

import { addDays, daysBetween, isWithinRange, type DateRange, type DateString } from "./dates";
import type { Card, Course, Session } from "@/lib/data/types";

type ScheduleSession = Pick<Session, "id" | "date" | "startTime">;

function compareSessions(a: ScheduleSession, b: ScheduleSession): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const timeA = a.startTime ?? "99:99";
  const timeB = b.startTime ?? "99:99";
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 다음 강의가 이 날수 안(오늘 포함)이면 홈 카드·과정 보드에서 눈에 띄게 표시한다 */
export const SESSION_SOON_DAYS = 3;

/** 강의 날짜가 오늘부터 SESSION_SOON_DAYS일 안이면 true (지난 날짜는 false) */
export function isSessionSoon(date: DateString, today: DateString): boolean {
  const diff = daysBetween(today, date);
  return diff >= 0 && diff <= SESSION_SOON_DAYS;
}

/** 날짜·시작 시간 순으로 정렬한 새 배열 */
export function sortSessions<T extends ScheduleSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareSessions);
}

/** 오늘 포함 앞으로의 회차 (가까운 순) */
export function upcomingSessions<T extends ScheduleSession>(
  sessions: readonly T[],
  today: DateString,
): T[] {
  return sortSessions(sessions.filter((session) => session.date >= today));
}

/** 오늘 포함 가장 가까운 회차. 없으면 null */
export function nextSession<T extends ScheduleSession>(
  sessions: readonly T[],
  today: DateString,
): T | null {
  return upcomingSessions(sessions, today)[0] ?? null;
}

/** 기간 안(양 끝 포함)의 회차 (가까운 순) */
export function sessionsInRange<T extends ScheduleSession>(
  sessions: readonly T[],
  range: DateRange,
): T[] {
  return sortSessions(sessions.filter((session) => isWithinRange(session.date, range)));
}

type DueCard = Pick<Card, "id" | "dueDate" | "done" | "deletedAt">;

/**
 * 마감이 다가온 카드: 안 끝났고, 휴지통이 아니고, 마감일이 today + withinDays 이전(지난 것 포함).
 * 마감일 순으로 정렬한다.
 */
export function dueSoonCards<T extends DueCard>(
  cards: readonly T[],
  today: DateString,
  withinDays = 7,
): T[] {
  const limit = addDays(today, withinDays);
  return cards
    .filter(
      (card) =>
        card.deletedAt === null && !card.done && card.dueDate !== null && card.dueDate <= limit,
    )
    .sort((a, b) => {
      const dateA = a.dueDate as string;
      const dateB = b.dueDate as string;
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * 홈 정렬: 다음 강의 날짜가 가까운 순. 예정된 회차가 없는 과정은 뒤에 두고 이름순.
 * nextDateByCourseId: 과정 id → 다음 회차 날짜 (없으면 키가 없거나 null)
 */
export function sortCoursesByNextSession<T extends Pick<Course, "id" | "title">>(
  courses: readonly T[],
  nextDateByCourseId: Readonly<Record<string, DateString | null | undefined>>,
): T[] {
  return [...courses].sort((a, b) => {
    const dateA = nextDateByCourseId[a.id] ?? null;
    const dateB = nextDateByCourseId[b.id] ?? null;
    if (dateA !== null && dateB !== null && dateA !== dateB) return dateA < dateB ? -1 : 1;
    if (dateA !== null && dateB === null) return -1;
    if (dateA === null && dateB !== null) return 1;
    return a.title.localeCompare(b.title, "ko");
  });
}
