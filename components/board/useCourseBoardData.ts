"use client";

// 과정 보드에 필요한 실시간 데이터 일곱 가지를 한곳에서 구독한다.
// 다른 강사가 바꾼 내용도 새로고침 없이 들어온다. 보드를 떠나면 모두 끊긴다.

import { subscribeCourse } from "@/lib/data/courses";
import { subscribeCards } from "@/lib/data/cards";
import { subscribeChecklistItems } from "@/lib/data/checklist";
import { subscribeCardFiles } from "@/lib/data/cardFiles";
import { subscribeSessions } from "@/lib/data/sessions";
import { subscribeEvents } from "@/lib/data/events";
import { subscribeMembers } from "@/lib/data/members";
import type { Card, CardFile, ChecklistItem, Course, CourseEvent, Member, Session } from "@/lib/data/types";
import { useLiveSubscription, type LiveValue } from "./useLiveSubscription";

const NO_CARDS: Card[] = [];
const NO_ITEMS: ChecklistItem[] = [];
const NO_FILES: CardFile[] = [];
const NO_SESSIONS: Session[] = [];
const NO_EVENTS: CourseEvent[] = [];
const NO_MEMBERS: Member[] = [];

export interface CourseBoardData {
  course: LiveValue<Course | null>;
  cards: LiveValue<Card[]>;
  checklistItems: LiveValue<ChecklistItem[]>;
  /** 카드 첨부 파일 목록 */
  cardFiles: LiveValue<CardFile[]>;
  sessions: LiveValue<Session[]>;
  /** 리허설·회의 같은 준비 일정 */
  events: LiveValue<CourseEvent[]>;
  members: LiveValue<Member[]>;
}

/** courseId가 null이면 아무것도 구독하지 않는다 (잘못된 주소일 때) */
export function useCourseBoardData(courseId: string | null): CourseBoardData {
  const course = useLiveSubscription<Course | null>(
    courseId,
    (onData, onError) => subscribeCourse(courseId ?? "", onData, onError),
    null,
  );
  const cards = useLiveSubscription(
    courseId,
    (onData, onError) => subscribeCards(courseId ?? "", onData, onError),
    NO_CARDS,
  );
  const checklistItems = useLiveSubscription(
    courseId,
    (onData, onError) => subscribeChecklistItems(courseId ?? "", onData, onError),
    NO_ITEMS,
  );
  const cardFiles = useLiveSubscription(
    courseId,
    (onData, onError) => subscribeCardFiles(courseId ?? "", onData, onError),
    NO_FILES,
  );
  const sessions = useLiveSubscription(
    courseId,
    (onData, onError) => subscribeSessions(courseId ?? "", onData, onError),
    NO_SESSIONS,
  );
  const events = useLiveSubscription(
    courseId,
    (onData, onError) => subscribeEvents(courseId ?? "", onData, onError),
    NO_EVENTS,
  );
  const members = useLiveSubscription(
    courseId === null ? null : "members",
    (onData, onError) => subscribeMembers(onData, onError),
    NO_MEMBERS,
  );
  return { course, cards, checklistItems, cardFiles, sessions, events, members };
}
