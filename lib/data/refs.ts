// Firestore 경로를 한곳에서 만든다. 컬렉션 이름은 firestore.rules와 같아야 한다.

import { collection, doc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";

export const COLLECTIONS = {
  members: "members",
  courses: "courses",
  cards: "cards",
  checklistItems: "checklistItems",
  cardFiles: "cardFiles",
  sessions: "sessions",
  materials: "materials",
  drafts: "drafts",
  outputs: "outputs",
  events: "events",
  // 과정 밖(최상위) 컬렉션: 여러 과정에 걸쳐 한 번에 모아 보므로 최상위에 둔다
  fees: "fees",
  clients: "clients",
  clientContacts: "clientContacts",
  // 최근 활동 기록: 서버 함수(functions/)만 쓰고 화면은 읽기만 한다
  activity: "activity",
} as const;

type CourseChild =
  | "cards"
  | "checklistItems"
  | "cardFiles"
  | "sessions"
  | "materials"
  | "drafts"
  | "outputs"
  | "events";

/** 과정 아래 컬렉션 */
export function courseChildCol(courseId: string, name: CourseChild): CollectionReference {
  return collection(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS[name]);
}

/** 과정 아래 문서 하나 */
export function courseChildDoc(courseId: string, name: CourseChild, id: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS[name], id);
}

/** 최상위 컬렉션 (강사료·고객사·담당자) */
type TopLevel = "fees" | "clients" | "clientContacts" | "activity";

export function topCol(name: TopLevel): CollectionReference {
  return collection(getDb(), COLLECTIONS[name]);
}

export function topDoc(name: TopLevel, id: string): DocumentReference {
  return doc(getDb(), COLLECTIONS[name], id);
}

export function membersCol(): CollectionReference {
  return collection(getDb(), COLLECTIONS.members);
}

export function memberDoc(email: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.members, email);
}

export function coursesCol(): CollectionReference {
  return collection(getDb(), COLLECTIONS.courses);
}

export function courseDoc(courseId: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.courses, courseId);
}

export function cardsCol(courseId: string): CollectionReference {
  return collection(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.cards);
}

export function cardDoc(courseId: string, cardId: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.cards, cardId);
}

export function checklistCol(courseId: string): CollectionReference {
  return collection(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.checklistItems);
}

export function checklistDoc(courseId: string, itemId: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.checklistItems, itemId);
}

export function sessionsCol(courseId: string): CollectionReference {
  return collection(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.sessions);
}

export function sessionDoc(courseId: string, sessionId: string): DocumentReference {
  return doc(getDb(), COLLECTIONS.courses, courseId, COLLECTIONS.sessions, sessionId);
}
