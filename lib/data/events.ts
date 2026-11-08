// 과정 일정(events) 읽기·쓰기: 리허설·회의 (PRD F8). 강의 회차(sessions)와 같은 방식이다.

import { deleteDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { isDateString } from "@/lib/domain/dates";
import { createId } from "@/lib/domain/ids";
import { sortSessions } from "@/lib/domain/schedule";
import { validateEventInput, validateEventPatch } from "@/lib/domain/validation";
import { courseChildCol, courseChildDoc } from "./refs";
import { toEvent } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type { CourseEvent, CreateOptions, ErrorHandler, EventInput, Unsubscribe } from "./types";

/** 과정 일정 구독 (날짜·시간 순). 날짜가 이상한 일정은 화면이 멈추지 않게 뺀다 */
export function subscribeEvents(
  courseId: string,
  onData: (events: CourseEvent[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => courseChildCol(courseId, "events"),
    (snapshot) => toEvent(courseId, snapshot),
    (events) => onData(sortSessions(events.filter((event) => isDateString(event.date)))),
    onError,
  );
}

/** 일정 추가. 돌려주는 값: 일정 id */
export async function createEvent(courseId: string, input: EventInput, options: CreateOptions = {}): Promise<string> {
  const check = validateEventInput({
    kind: input.kind,
    title: input.title,
    date: input.date,
    startTime: input.startTime ?? null,
    note: input.note ?? "",
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const eventId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(courseChildDoc(courseId, "events", eventId), {
        ...check.value,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `event:create:${courseId}:${eventId}`,
  );
  return eventId;
}

/** 일정 고치기. 바꿀 칸만 넣는다 */
export async function updateEvent(courseId: string, eventId: string, patch: Partial<EventInput>): Promise<void> {
  const check = validateEventPatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "events", eventId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 일정 지우기 (바로 삭제. 회차와 같다) */
export async function deleteEvent(courseId: string, eventId: string): Promise<void> {
  await runWrite(() => deleteDoc(courseChildDoc(courseId, "events", eventId)));
}
