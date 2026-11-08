// 서버(Admin SDK)에서 읽은 Firestore 문서를 알림 계산용 모양으로 바꾼다 (순수 함수).
// 값이 빠졌거나 이상해도 작업이 멈추지 않게 안전한 기본값을 넣는다 (lib/data/convert.ts와 같은 규칙).

import { isDateString } from "@/lib/domain/dates";
import { isRole } from "@/lib/domain/roles";
import type { NoticeCourse, NoticeFee, NoticeMember, NoticeSession } from "@/lib/domain/notices";

type Data = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase())
    : [];
}

/** Firestore Timestamp → 밀리초. 값이 없으면 null */
function millis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

export function memberFromData(id: string, data: Data): NoticeMember {
  return {
    email: id.trim().toLowerCase(),
    role: isRole(data.role) ? data.role : "instructor",
    displayName: str(data.displayName),
  };
}

export function courseFromData(id: string, data: Data): NoticeCourse {
  // deletedAt이 Timestamp가 아닌 이상한 값이어도 null이 아니면 휴지통으로 본다 (알리지 않는 쪽이 안전하다)
  const deletedAt = data.deletedAt === null || data.deletedAt === undefined ? null : (millis(data.deletedAt) ?? 1);
  return {
    id,
    title: str(data.title, "(제목 없음)"),
    client: str(data.client),
    instructorEmails: strList(data.instructorEmails),
    status: data.status === "archived" ? "archived" : "active",
    deletedAt,
  };
}

export function sessionFromData(id: string, data: Data): NoticeSession {
  const startTime = str(data.startTime);
  return {
    id,
    date: str(data.date),
    startTime: startTime.length > 0 ? startTime : null,
    location: str(data.location),
    audience: str(data.audience),
  };
}

export function feeFromData(id: string, data: Data): NoticeFee {
  const amount = typeof data.amount === "number" && Number.isSafeInteger(data.amount) && data.amount > 0 ? data.amount : 0;
  return {
    id,
    courseId: str(data.courseId),
    instructorEmail: str(data.instructorEmail).trim().toLowerCase(),
    label: str(data.label),
    amount,
    dueDate: str(data.dueDate),
    paidDate: isDateString(data.paidDate) ? data.paidDate : null,
  };
}
