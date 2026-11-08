// 회차(sessions) 읽기·쓰기. 회차 = 과정을 실제로 진행하는 날짜·장소·대상.

import { deleteDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createId } from "@/lib/domain/ids";
import { isDateString } from "@/lib/domain/dates";
import { sortSessions } from "@/lib/domain/schedule";
import { validateSessionInput, validateSessionPatch } from "@/lib/domain/validation";
import { sessionDoc, sessionsCol } from "./refs";
import { toSession } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type { CreateOptions, ErrorHandler, Session, SessionInput, Unsubscribe } from "./types";

/** 과정의 회차 구독 (날짜·시작 시간 순). 없는 날짜가 저장된 회차는 화면이 멈추지 않게 뺀다 */
export function subscribeSessions(
  courseId: string,
  onData: (sessions: Session[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => sessionsCol(courseId),
    (snapshot) => toSession(courseId, snapshot),
    (sessions) => onData(sortSessions(sessions.filter((session) => isDateString(session.date)))),
    onError,
  );
}

/** 회차 추가. 돌려주는 값: 회차 id */
export async function createSession(
  courseId: string,
  input: SessionInput,
  options: CreateOptions = {},
): Promise<string> {
  const check = validateSessionInput({
    date: input.date,
    startTime: input.startTime ?? null,
    location: input.location ?? "",
    audience: input.audience ?? "",
    note: input.note ?? "",
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const sessionId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(sessionDoc(courseId, sessionId), {
        ...check.value,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `session:create:${courseId}:${sessionId}`,
  );
  return sessionId;
}

/** 회차 고치기. 바꿀 칸만 넣는다. */
export async function updateSession(
  courseId: string,
  sessionId: string,
  patch: Partial<SessionInput>,
): Promise<void> {
  const check = validateSessionPatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(sessionDoc(courseId, sessionId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 회차 지우기 (바로 삭제) */
export async function deleteSession(courseId: string, sessionId: string): Promise<void> {
  await runWrite(() => deleteDoc(sessionDoc(courseId, sessionId)));
}
