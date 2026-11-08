// 홈·캘린더용: 여러 과정의 카드·회차·준비 일정(리허설·회의)을 한 번에 구독한다.
// 진행 중 과정이 많아야 10개 안팎이라 과정마다 리스너 3개(카드, 회차, 일정)를 연다.

import { subscribeCards } from "./cards";
import { subscribeEvents } from "./events";
import { subscribeSessions } from "./sessions";
import type { Card, CourseEvent, ErrorHandler, Session, Unsubscribe } from "./types";

export interface CourseDetail {
  cards: Card[];
  sessions: Session[];
  /** 리허설·회의 같은 준비 일정 (날짜·시간 순) */
  events: CourseEvent[];
  /** 카드·회차·일정을 모두 한 번 이상 받았으면 true */
  loaded: boolean;
}

interface CourseDetailState {
  cards: Card[] | null;
  sessions: Session[] | null;
  events: CourseEvent[] | null;
}

/**
 * courseIds의 카드·회차·일정을 구독하고, 어느 하나라도 바뀌면 전체 묶음을 onData로 준다.
 * courseIds가 바뀌면 이전 구독을 해제하고 새로 부른다 (useEffect 의존성에 courseIds 문자열을 넣는다).
 */
export function subscribeCoursesDetails(
  courseIds: readonly string[],
  onData: (details: Record<string, CourseDetail>) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const state: Record<string, CourseDetailState> = {};
  const unsubscribers: Unsubscribe[] = [];
  let closed = false;

  const emit = () => {
    if (closed) return;
    const details: Record<string, CourseDetail> = {};
    for (const courseId of courseIds) {
      const entry = state[courseId];
      details[courseId] = {
        cards: entry?.cards ?? [],
        sessions: entry?.sessions ?? [],
        events: entry?.events ?? [],
        loaded: Boolean(entry && entry.cards !== null && entry.sessions !== null && entry.events !== null),
      };
    }
    onData(details);
  };

  for (const courseId of new Set(courseIds)) {
    state[courseId] = { cards: null, sessions: null, events: null };
    unsubscribers.push(
      subscribeCards(
        courseId,
        (cards) => {
          state[courseId].cards = cards;
          emit();
        },
        onError,
      ),
    );
    unsubscribers.push(
      subscribeSessions(
        courseId,
        (sessions) => {
          state[courseId].sessions = sessions;
          emit();
        },
        onError,
      ),
    );
    unsubscribers.push(
      subscribeEvents(
        courseId,
        (events) => {
          state[courseId].events = events;
          emit();
        },
        onError,
      ),
    );
  }

  if (courseIds.length === 0) emit();

  return () => {
    closed = true;
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
