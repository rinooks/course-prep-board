// 홈 화면 계산: 과정 카드 목록(다음 강의 순)과 "오늘·이번 주" 일정 묶음.
// 화면 코드와 분리한 순수 함수라 tests/unit/home-overview.test.ts에서 검사한다.

import type { CourseDetail } from "@/lib/data/overview";
import type { Card, Course, Session } from "@/lib/data/types";
import { addDays, type DateRange, type DateString } from "@/lib/domain/dates";
import { summarizeProgress, type CourseProgress } from "@/lib/domain/progress";
import {
  dueSoonCards,
  nextSession,
  sessionsInRange,
  sortCoursesByNextSession,
} from "@/lib/domain/schedule";

/** "오늘·이번 주"가 보여주는 기간 (오늘 포함 7일) */
export const AGENDA_DAYS = 7;

export interface CourseOverview {
  course: Course;
  /** 카드·회차를 한 번 이상 받았으면 true */
  loaded: boolean;
  progress: CourseProgress;
  /** 오늘 포함 가장 가까운 회차 */
  nextSession: Session | null;
}

/**
 * 과정 카드 목록. 다음 강의가 가까운 순이고, 예정된 강의가 없는 과정은 뒤에 이름순으로 둔다.
 * details에 아직 없는 과정은 loaded=false로 들어간다.
 */
export function buildCourseOverviews(
  courses: readonly Course[],
  details: Readonly<Record<string, CourseDetail>>,
  today: DateString,
): CourseOverview[] {
  const overviews = courses.map((course) => {
    const detail = details[course.id];
    return {
      course,
      loaded: detail?.loaded ?? false,
      progress: summarizeProgress(detail?.cards ?? []),
      nextSession: nextSession(detail?.sessions ?? [], today),
    };
  });

  const nextDateByCourseId: Record<string, DateString | null> = {};
  for (const overview of overviews) {
    nextDateByCourseId[overview.course.id] = overview.nextSession?.date ?? null;
  }

  // 정렬 함수는 id·title만 보므로, 정렬용 묶음을 만들어 정렬한 뒤 다시 꺼낸다
  const sortable = overviews.map((overview) => ({
    id: overview.course.id,
    title: overview.course.title,
    overview,
  }));
  return sortCoursesByNextSession(sortable, nextDateByCourseId).map((item) => item.overview);
}

/** 진행률을 받은 과정들의 평균 진행률(0~100, 내림). 받은 과정이 없으면 null */
export function averagePercent(overviews: readonly Pick<CourseOverview, "loaded" | "progress">[]): number | null {
  const loaded = overviews.filter((overview) => overview.loaded);
  if (loaded.length === 0) return null;
  const sum = loaded.reduce((total, overview) => total + overview.progress.percent, 0);
  return Math.floor(sum / loaded.length);
}

export interface AgendaSession {
  session: Session;
  course: Course;
}

export interface AgendaDay {
  date: DateString;
  sessions: AgendaSession[];
}

export interface AgendaCard {
  card: Card;
  course: Course;
}

export interface HomeAgenda {
  range: DateRange;
  /** 강의가 있는 날만, 날짜 순 */
  days: AgendaDay[];
  sessionCount: number;
  /** 안 끝난 카드 중 마감이 지났거나 기간 안에 마감인 것 (마감일 순) */
  dueCards: AgendaCard[];
}

/**
 * "오늘·이번 주" 묶음. 오늘부터 days일(오늘 포함) 안의 강의와 마감이 다가온 카드를 모은다.
 * 일요일에도 다음 주 월요일(내일) 강의가 보이도록 달력 주 대신 오늘부터 7일을 쓴다.
 */
export function buildAgenda(
  courses: readonly Course[],
  details: Readonly<Record<string, CourseDetail>>,
  today: DateString,
  days: number = AGENDA_DAYS,
): HomeAgenda {
  const range: DateRange = { start: today, end: addDays(today, days - 1) };
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const allSessions: Session[] = [];
  const allCards: Card[] = [];
  for (const course of courses) {
    const detail = details[course.id];
    if (!detail) continue;
    allSessions.push(...detail.sessions);
    allCards.push(...detail.cards);
  }

  const dayMap = new Map<DateString, AgendaSession[]>();
  let sessionCount = 0;
  for (const session of sessionsInRange(allSessions, range)) {
    const course = courseById.get(session.courseId);
    if (!course) continue;
    const list = dayMap.get(session.date) ?? [];
    list.push({ session, course });
    dayMap.set(session.date, list);
    sessionCount += 1;
  }
  // sessionsInRange가 날짜 순으로 주므로 Map에 넣은 순서가 곧 날짜 순이다
  const agendaDays: AgendaDay[] = Array.from(dayMap, ([date, sessions]) => ({ date, sessions }));

  const dueCards: AgendaCard[] = [];
  for (const card of dueSoonCards(allCards, today, days - 1)) {
    const course = courseById.get(card.courseId);
    if (course) dueCards.push({ card, course });
  }

  return { range, days: agendaDays, sessionCount, dueCards };
}

/** 홈을 팀 전체로 볼지, 내 것만 볼지 */
export type HomeScope = "team" | "mine";

function sameEmail(a: string | null, b: string): boolean {
  return a !== null && a.toLowerCase() === b.toLowerCase();
}

function isInstructorOf(course: Pick<Course, "instructorEmails">, email: string): boolean {
  return course.instructorEmails.some((item) => sameEmail(item, email));
}

/** "내 것만"이면 내가 담당 강사인 과정만 남긴다. 팀 전체면 그대로 */
export function coursesInScope<T extends Pick<Course, "instructorEmails">>(
  courses: readonly T[],
  scope: HomeScope,
  email: string,
): T[] {
  if (scope === "team") return [...courses];
  return courses.filter((course) => isInstructorOf(course, email));
}

/**
 * "내 것만"이면 일정 묶음을 나에게 맞게 줄인다.
 * - 강의: 내가 담당 강사인 과정의 회차만
 * - 마감 카드: 어느 과정이든 나에게 맡긴 카드만 (담당 강사가 아닌 과정의 카드도 내 일이다)
 */
export function agendaInScope(agenda: HomeAgenda, scope: HomeScope, email: string): HomeAgenda {
  if (scope === "team") return agenda;

  const days: AgendaDay[] = [];
  let sessionCount = 0;
  for (const day of agenda.days) {
    const sessions = day.sessions.filter(({ course }) => isInstructorOf(course, email));
    if (sessions.length === 0) continue;
    days.push({ date: day.date, sessions });
    sessionCount += sessions.length;
  }

  const dueCards = agenda.dueCards.filter(({ card }) => sameEmail(card.assigneeEmail, email));
  return { range: agenda.range, days, sessionCount, dueCards };
}

/** 과정 목록이 바뀌어도 순서만 바뀐 경우 다시 구독하지 않도록, id를 정렬해 한 문자열로 만든다 */
export function courseIdsKey(courses: readonly Pick<Course, "id">[]): string {
  return courses
    .map((course) => course.id)
    .sort()
    .join(",");
}
