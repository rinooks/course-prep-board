// 체크리스트 항목(checklistItems) 읽기·쓰기.
// 항목마다 문서가 따로 있어서 두 사람이 동시에 다른 항목을 체크해도 서로 덮어쓰지 않는다.
// 과정 하나의 모든 항목을 한 번에 구독한다 (보드 화면 리스너 1개).

import { deleteDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { createId, isSafeId } from "@/lib/domain/ids";
import { planMove, type OrderedItem } from "@/lib/domain/ordering";
import { validateChecklistText } from "@/lib/domain/validation";
import { checklistCol, checklistDoc } from "./refs";
import { toChecklistItem } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  ChecklistItem,
  ChecklistItemCreateInput,
  CreateOptions,
  ErrorHandler,
  Unsubscribe,
} from "./types";

/** 과정의 체크리스트 항목 전체 구독. 카드별로는 groupChecklistByCard(items)로 묶는다. */
export function subscribeChecklistItems(
  courseId: string,
  onData: (items: ChecklistItem[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => checklistCol(courseId),
    (snapshot) => toChecklistItem(courseId, snapshot),
    onData,
    onError,
  );
}

/** 항목 추가. 돌려주는 값: 항목 id */
export async function createChecklistItem(
  courseId: string,
  input: ChecklistItemCreateInput,
  options: CreateOptions = {},
): Promise<string> {
  const check = validateChecklistText(input.text);
  if (!check.ok) throwValidation(check.errors);
  if (!isSafeId(input.cardId)) {
    throwValidation({ text: "카드를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요." });
  }

  const actor = requireActorEmail();
  const itemId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(checklistDoc(courseId, itemId), {
        cardId: input.cardId,
        text: check.value,
        done: false,
        order: Number.isFinite(input.order) ? input.order : 0,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `checklist:create:${courseId}:${itemId}`,
  );
  return itemId;
}

/** 체크 켜기/끄기. 값을 지정하므로 다시 시도해도 안전하다. */
export async function setChecklistItemDone(
  courseId: string,
  itemId: string,
  done: boolean,
): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(checklistDoc(courseId, itemId), {
      done,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 항목 글 고치기 */
export async function updateChecklistItemText(
  courseId: string,
  itemId: string,
  text: string,
): Promise<void> {
  const check = validateChecklistText(text);
  if (!check.ok) throwValidation(check.errors);
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(checklistDoc(courseId, itemId), {
      text: check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 항목 지우기 (바로 삭제, 되살리기 없음) */
export async function deleteChecklistItem(courseId: string, itemId: string): Promise<void> {
  await runWrite(() => deleteDoc(checklistDoc(courseId, itemId)));
}

/**
 * 카드 안에서 항목 순서 바꾸기.
 * siblings: 같은 카드의 항목들 (옮기는 항목은 빼도 되고 넣어도 된다)
 * targetIndex: 옮긴 뒤 자리 (0부터)
 */
export async function reorderChecklistItem(
  courseId: string,
  itemId: string,
  siblings: readonly OrderedItem[],
  targetIndex: number,
): Promise<void> {
  const plan = planMove(
    siblings.filter((item) => item.id !== itemId),
    targetIndex,
  );
  const actor = requireActorEmail();
  const touch = { updatedAt: serverTimestamp(), updatedBy: actor };

  if (plan.updates.length === 0) {
    await runWrite(() => updateDoc(checklistDoc(courseId, itemId), { order: plan.order, ...touch }));
    return;
  }
  const batch = writeBatch(getDb());
  batch.update(checklistDoc(courseId, itemId), { order: plan.order, ...touch });
  for (const update of plan.updates) {
    batch.update(checklistDoc(courseId, update.id), { order: update.order, ...touch });
  }
  await runWrite(() => batch.commit());
}
