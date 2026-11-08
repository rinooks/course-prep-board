// Firestore 문서를 화면용 타입으로 바꾼다.
// 값이 빠졌거나 모양이 이상해도 화면이 깨지지 않도록 안전한 기본값을 넣는다.

import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { isStageId } from "@/lib/domain/stages";
import { isRole } from "@/lib/domain/roles";
import { isDateString } from "@/lib/domain/dates";
import { isDraftKind } from "@/lib/domain/drafts";
import { isEventKind } from "@/lib/domain/events";
import { isMaterialKind } from "@/lib/domain/materials";
import type {
  Activity,
  Card,
  CardFile,
  ChecklistItem,
  Client,
  ClientContact,
  Course,
  CourseEvent,
  Draft,
  Fee,
  Material,
  Member,
  Output,
  Session,
} from "./types";

type Snapshot = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

/** 서버 시각이 아직 확정되지 않은 값은 추정값으로 읽는다 */
function readData(snapshot: Snapshot): DocumentData {
  return snapshot.data({ serverTimestamps: "estimate" }) ?? {};
}

export function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function toMember(snapshot: Snapshot): Member {
  const data = readData(snapshot);
  return {
    email: snapshot.id,
    role: isRole(data.role) ? data.role : "instructor",
    displayName: str(data.displayName),
    photoURL: str(data.photoURL),
    uid: nullableStr(data.uid),
    invitedBy: str(data.invitedBy),
    invitedAt: toMillis(data.invitedAt),
    lastLoginAt: toMillis(data.lastLoginAt),
  };
}

export function toCourse(snapshot: Snapshot): Course {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    title: str(data.title, "(제목 없음)"),
    client: str(data.client),
    description: str(data.description),
    instructorEmails: strList(data.instructorEmails),
    status: data.status === "archived" ? "archived" : "active",
    deletedAt: toMillis(data.deletedAt),
    deletedBy: nullableStr(data.deletedBy),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toSession(courseId: string, snapshot: Snapshot): Session {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    date: str(data.date),
    startTime: nullableStr(data.startTime),
    location: str(data.location),
    audience: str(data.audience),
    note: str(data.note),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toCard(courseId: string, snapshot: Snapshot): Card {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    stage: isStageId(data.stage) ? data.stage : "request",
    title: str(data.title, "(제목 없음)"),
    order: num(data.order),
    assigneeEmail: nullableStr(data.assigneeEmail),
    // 없는 날짜(예: 2026-13-40)는 화면의 날짜 계산을 멈추게 하므로 마감일 없음으로 본다
    dueDate: isDateString(data.dueDate) ? data.dueDate : null,
    memo: str(data.memo),
    done: data.done === true,
    deletedAt: toMillis(data.deletedAt),
    deletedBy: nullableStr(data.deletedBy),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toMaterial(courseId: string, snapshot: Snapshot): Material {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    kind: isMaterialKind(data.kind) ? data.kind : "text",
    title: str(data.title, "(제목 없음)"),
    body: str(data.body),
    url: str(data.url),
    stage: isStageId(data.stage) ? data.stage : null,
    memo: str(data.memo),
    excludeFromAi: data.excludeFromAi === true,
    deletedAt: toMillis(data.deletedAt),
    deletedBy: nullableStr(data.deletedBy),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toDraft(courseId: string, snapshot: Snapshot): Draft {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    kind: isDraftKind(data.kind) ? data.kind : "curriculum",
    version: num(data.version, 1),
    content: str(data.content),
    request: str(data.request),
    materialIds: strList(data.materialIds),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toOutput(courseId: string, snapshot: Snapshot): Output {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    kind: isDraftKind(data.kind) ? data.kind : "curriculum",
    version: num(data.version, 1),
    content: str(data.content),
    sourceDraftId: str(data.sourceDraftId),
    finalUrl: str(data.finalUrl),
    isFinal: data.isFinal === true,
    deletedAt: toMillis(data.deletedAt),
    deletedBy: nullableStr(data.deletedBy),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

/** 강사료. 금액이 이상하면 0, 날짜가 이상한 입금일은 "입금 전"으로 읽는다 */
export function toFee(snapshot: Snapshot): Fee {
  const data = readData(snapshot);
  const amount = num(data.amount);
  return {
    id: snapshot.id,
    courseId: str(data.courseId),
    instructorEmail: str(data.instructorEmail),
    label: str(data.label),
    amount: Number.isSafeInteger(amount) && amount > 0 ? amount : 0,
    dueDate: str(data.dueDate),
    paidDate: isDateString(data.paidDate) ? data.paidDate : null,
    memo: str(data.memo),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toClient(snapshot: Snapshot): Client {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    name: str(data.name, "(이름 없음)"),
    memo: str(data.memo),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toContact(snapshot: Snapshot): ClientContact {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    clientId: str(data.clientId),
    name: str(data.name, "(이름 없음)"),
    role: str(data.role),
    phone: str(data.phone),
    email: str(data.email),
    memo: str(data.memo),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toEvent(courseId: string, snapshot: Snapshot): CourseEvent {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    kind: isEventKind(data.kind) ? data.kind : "meeting",
    title: str(data.title, "(이름 없음)"),
    date: str(data.date),
    startTime: nullableStr(data.startTime),
    note: str(data.note),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}

export function toActivity(snapshot: Snapshot): Activity {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId: str(data.courseId),
    cardId: str(data.cardId),
    actorEmail: str(data.actorEmail),
    fileName: str(data.fileName),
    moved: typeof data.toStage === "string" && data.toStage.length > 0,
    message: str(data.message, "(내용 없는 기록)"),
    createdAt: toMillis(data.createdAt),
  };
}

export function toCardFile(courseId: string, snapshot: Snapshot): CardFile {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    cardId: str(data.cardId),
    name: str(data.name, "(이름 없는 파일)"),
    size: num(data.size),
    contentType: str(data.contentType),
    storagePath: str(data.storagePath),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
  };
}

export function toChecklistItem(courseId: string, snapshot: Snapshot): ChecklistItem {
  const data = readData(snapshot);
  return {
    id: snapshot.id,
    courseId,
    cardId: str(data.cardId),
    text: str(data.text),
    done: data.done === true,
    order: num(data.order),
    createdBy: str(data.createdBy),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    updatedBy: str(data.updatedBy),
  };
}
