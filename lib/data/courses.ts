// 과정(courses) 읽기·쓰기.
// 과정을 만들 때 기본 카드·체크리스트·회차까지 한 번의 묶음 쓰기(batch)로 저장한다.
// 묶음 쓰기는 전부 저장되거나 전부 실패하므로, 카드가 반만 생긴 과정이 남지 않는다.

import {
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { copyWriteCount, MAX_COPY_WRITES, type CopyCardPlan } from "@/lib/domain/courseCopy";
import { AppError } from "@/lib/domain/errors";
import { createId } from "@/lib/domain/ids";
import { DEFAULT_TEMPLATE, STAGE_IDS } from "@/lib/domain/stages";
import { rebalancedOrders } from "@/lib/domain/ordering";
import {
  hasErrors,
  validateCourseInput,
  validateCoursePatch,
  validateSessionInput,
  type FieldErrors,
} from "@/lib/domain/validation";
import { cardDoc, checklistDoc, courseDoc, coursesCol, sessionDoc } from "./refs";
import { toCourse } from "./convert";
import { listenDoc, listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  Course,
  CourseCreateInput,
  CourseUpdateInput,
  CreateOptions,
  ErrorHandler,
  Unsubscribe,
} from "./types";

export type CourseListFilter = "active" | "archived" | "trashed";

function byUpdatedDesc(a: Course, b: Course): number {
  return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
}

/**
 * 과정 목록 구독.
 * - active: 진행 중 (휴지통 제외)
 * - archived: 보관함 (휴지통 제외)
 * - trashed: 휴지통 (보관 여부와 무관, 최근에 지운 순)
 * active·archived는 최근 수정 순으로 준다. 홈 정렬은 sortCoursesByNextSession을 쓴다.
 */
export function subscribeCourses(
  filter: CourseListFilter,
  onData: (courses: Course[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const buildQuery = () => {
    if (filter === "trashed") {
      return query(coursesCol(), where("deletedAt", "!=", null));
    }
    return query(coursesCol(), where("status", "==", filter), where("deletedAt", "==", null));
  };
  return listenQuery(
    buildQuery,
    toCourse,
    (courses) => {
      if (filter === "trashed") {
        onData([...courses].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)));
      } else {
        onData([...courses].sort(byUpdatedDesc));
      }
    },
    onError,
  );
}

/** 과정 하나 구독. 없거나 지워졌으면 onData(null) — 휴지통 과정은 course.deletedAt으로 구분 */
export function subscribeCourse(
  courseId: string,
  onData: (course: Course | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenDoc(() => courseDoc(courseId), toCourse, onData, onError);
}

/**
 * 과정 만들기. 7단계 기본 카드와 체크리스트, 입력한 회차를 함께 만든다.
 * 같은 options.id로 다시 부르면 새로 만들지 않고 처음 작업 결과를 기다린다.
 * 돌려주는 값: 과정 id
 * 입력이 잘못되면 AppError("invalid-input") — fieldErrorsOf(error)로 칸별 메시지를 얻는다.
 *   회차 오류는 "sessions.0.date" 같은 키로 들어온다.
 */
export async function createCourse(
  input: CourseCreateInput,
  options: CreateOptions = {},
): Promise<string> {
  const courseCheck = validateCourseInput({
    title: input.title,
    client: input.client ?? "",
    description: input.description ?? "",
    instructorEmails: input.instructorEmails ?? [],
  });
  const errors: FieldErrors = courseCheck.ok ? {} : { ...courseCheck.errors };

  const sessions = (input.sessions ?? []).map((session, index) => {
    const check = validateSessionInput({
      date: session.date,
      startTime: session.startTime ?? null,
      location: session.location ?? "",
      audience: session.audience ?? "",
      note: session.note ?? "",
    });
    if (!check.ok) {
      for (const [field, message] of Object.entries(check.errors)) {
        errors[`sessions.${index}.${field}`] = message;
      }
      return null;
    }
    return check.value;
  });

  if (!courseCheck.ok || hasErrors(errors)) throwValidation(errors);
  const course = courseCheck.value;

  const actor = requireActorEmail();
  const courseId = options.id ?? createId();
  const db = getDb();

  const stamp = () => ({
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  const batch = writeBatch(db);
  batch.set(courseDoc(courseId), {
    title: course.title,
    client: course.client,
    description: course.description,
    instructorEmails: course.instructorEmails,
    status: "active",
    deletedAt: null,
    deletedBy: null,
    ...stamp(),
  });

  for (const stageId of STAGE_IDS) {
    const templates = DEFAULT_TEMPLATE.filter((card) => card.stage === stageId);
    const cardOrders = rebalancedOrders(templates.length);
    templates.forEach((template, cardIndex) => {
      const cardId = createId();
      batch.set(cardDoc(courseId, cardId), {
        stage: stageId,
        title: template.title,
        order: cardOrders[cardIndex],
        assigneeEmail: null,
        dueDate: null,
        memo: "",
        done: false,
        deletedAt: null,
        deletedBy: null,
        ...stamp(),
      });
      const itemOrders = rebalancedOrders(template.checklist.length);
      template.checklist.forEach((text, itemIndex) => {
        batch.set(checklistDoc(courseId, createId()), {
          cardId,
          text,
          done: false,
          order: itemOrders[itemIndex],
          ...stamp(),
        });
      });
    });
  }

  for (const session of sessions) {
    if (!session) continue;
    batch.set(sessionDoc(courseId, createId()), { ...session, ...stamp() });
  }

  await runWrite(() => batch.commit(), `course:create:${courseId}`);
  return courseId;
}

/**
 * 과정 복제: 새 과정과 복사할 카드·체크리스트(planCourseCopy 결과)를 한 묶음으로 저장한다.
 * 묶음 쓰기라 카드가 반만 복사된 과정은 남지 않는다. 회차(날짜)는 복사하지 않는다.
 * 같은 options.id로 다시 부르면 새로 만들지 않고 처음 작업 결과를 기다린다.
 * 돌려주는 값: 새 과정 id
 */
export async function duplicateCourse(
  input: Omit<CourseCreateInput, "sessions">,
  plans: readonly CopyCardPlan[],
  options: CreateOptions = {},
): Promise<string> {
  const courseCheck = validateCourseInput({
    title: input.title,
    client: input.client ?? "",
    description: input.description ?? "",
    instructorEmails: input.instructorEmails ?? [],
  });
  if (!courseCheck.ok) throwValidation(courseCheck.errors);
  const course = courseCheck.value;

  const writeCount = copyWriteCount(plans);
  if (writeCount > MAX_COPY_WRITES) {
    throw new AppError(
      "too-many-documents",
      `카드와 체크리스트가 너무 많아(${writeCount - 1}개) 한 번에 복사할 수 없습니다. 쓰지 않는 카드를 휴지통으로 옮긴 뒤 다시 시도해 주세요.`,
    );
  }

  const actor = requireActorEmail();
  const courseId = options.id ?? createId();
  const stamp = () => ({
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  const batch = writeBatch(getDb());
  batch.set(courseDoc(courseId), {
    title: course.title,
    client: course.client,
    description: course.description,
    instructorEmails: course.instructorEmails,
    status: "active",
    deletedAt: null,
    deletedBy: null,
    ...stamp(),
  });

  for (const plan of plans) {
    const cardId = createId();
    batch.set(cardDoc(courseId, cardId), {
      stage: plan.stage,
      title: plan.title,
      order: plan.order,
      assigneeEmail: plan.assigneeEmail,
      dueDate: null,
      memo: plan.memo,
      done: false,
      deletedAt: null,
      deletedBy: null,
      ...stamp(),
    });
    for (const item of plan.checklist) {
      batch.set(checklistDoc(courseId, createId()), {
        cardId,
        text: item.text,
        done: false,
        order: item.order,
        ...stamp(),
      });
    }
  }

  await runWrite(() => batch.commit(), `course:duplicate:${courseId}`);
  return courseId;
}

/** 과정 정보 고치기 (이름·고객사·설명·담당 강사). 바꿀 칸만 넣는다. */
export async function updateCourse(courseId: string, patch: CourseUpdateInput): Promise<void> {
  const check = validateCoursePatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseDoc(courseId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

async function setCourseFields(courseId: string, fields: DocumentData): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseDoc(courseId), { ...fields, updatedAt: serverTimestamp(), updatedBy: actor }),
  );
}

/** 끝난 과정을 보관함으로 (모든 팀원 가능) */
export function archiveCourse(courseId: string): Promise<void> {
  return setCourseFields(courseId, { status: "archived" });
}

/** 보관함에서 다시 진행 중으로 */
export function unarchiveCourse(courseId: string): Promise<void> {
  return setCourseFields(courseId, { status: "active" });
}

/** 휴지통으로 (관리자만. 아니면 permission-denied) */
export function trashCourse(courseId: string): Promise<void> {
  const actor = requireActorEmail();
  return setCourseFields(courseId, { deletedAt: serverTimestamp(), deletedBy: actor });
}

/** 휴지통에서 되살리기 (관리자만). 보관 상태(status)는 지우기 전 그대로 */
export function restoreCourse(courseId: string): Promise<void> {
  return setCourseFields(courseId, { deletedAt: null, deletedBy: null });
}
