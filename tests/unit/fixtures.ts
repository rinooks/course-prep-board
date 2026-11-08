// 테스트용 가짜 데이터 만들기
import type { Card, ChecklistItem, CourseEvent, Session } from "@/lib/data/types";

export function makeCard(overrides: Partial<Card> & Pick<Card, "id">): Card {
  return {
    courseId: "course1",
    stage: "request",
    title: "카드",
    order: 1024,
    assigneeEmail: null,
    dueDate: null,
    memo: "",
    done: false,
    deletedAt: null,
    deletedBy: null,
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}

export function makeItem(overrides: Partial<ChecklistItem> & Pick<ChecklistItem, "id" | "cardId">): ChecklistItem {
  return {
    courseId: "course1",
    text: "항목",
    done: false,
    order: 1024,
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}

export function makeSession(overrides: Partial<Session> & Pick<Session, "id" | "date">): Session {
  return {
    courseId: "course1",
    startTime: null,
    location: "",
    audience: "",
    note: "",
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<CourseEvent> & Pick<CourseEvent, "id" | "date">): CourseEvent {
  return {
    courseId: "course1",
    kind: "rehearsal",
    title: "리허설",
    startTime: null,
    note: "",
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}
