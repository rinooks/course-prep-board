// 카드(cards) 읽기·쓰기. 카드 삭제는 휴지통 표시(deletedAt)로만 한다.

import { serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { createId } from "@/lib/domain/ids";
import { planMove, type OrderedItem } from "@/lib/domain/ordering";
import { validateCardInput, validateCardPatch, validateStage } from "@/lib/domain/validation";
import type { StageId } from "@/lib/domain/stages";
import { cardDoc, cardsCol } from "./refs";
import { toCard } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  Card,
  CardCreateInput,
  CardUpdateInput,
  CreateOptions,
  ErrorHandler,
  Unsubscribe,
} from "./types";

/**
 * 과정의 카드 전체 구독 (휴지통 카드 포함).
 * 보드에는 groupCardsByStage(cards), 휴지통 목록에는 trashedCards(cards)를 쓴다.
 */
export function subscribeCards(
  courseId: string,
  onData: (cards: Card[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => cardsCol(courseId),
    (snapshot) => toCard(courseId, snapshot),
    onData,
    onError,
  );
}

/** 카드 만들기. 돌려주는 값: 카드 id */
export async function createCard(
  courseId: string,
  input: CardCreateInput,
  options: CreateOptions = {},
): Promise<string> {
  const stageCheck = validateStage(input.stage);
  if (!stageCheck.ok) throwValidation(stageCheck.errors);
  const check = validateCardInput({
    title: input.title,
    memo: input.memo ?? "",
    assigneeEmail: input.assigneeEmail ?? null,
    dueDate: input.dueDate ?? null,
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const cardId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(cardDoc(courseId, cardId), {
        stage: stageCheck.value,
        title: check.value.title,
        order: Number.isFinite(input.order) ? input.order : 0,
        assigneeEmail: check.value.assigneeEmail,
        dueDate: check.value.dueDate,
        memo: check.value.memo,
        done: false,
        deletedAt: null,
        deletedBy: null,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `card:create:${courseId}:${cardId}`,
  );
  return cardId;
}

/** 카드 고치기 (제목·담당자·마감일·메모·완료). 바꿀 칸만 넣는다. */
export async function updateCard(
  courseId: string,
  cardId: string,
  patch: CardUpdateInput,
): Promise<void> {
  const { done, ...fields } = patch;
  const check = validateCardPatch(fields);
  if (!check.ok) throwValidation(check.errors);

  const data: Record<string, unknown> = { ...check.value };
  if (typeof done === "boolean") data.done = done;
  if (Object.keys(data).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(cardDoc(courseId, cardId), {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 완료 표시 켜기/끄기. 뒤집기(toggle)가 아니라 값을 지정하므로 다시 시도해도 안전하다. */
export function setCardDone(courseId: string, cardId: string, done: boolean): Promise<void> {
  return updateCard(courseId, cardId, { done });
}

/**
 * 카드를 다른 단계로 옮기거나 같은 단계 안에서 순서를 바꾼다.
 * targetSiblings: 옮겨 갈 단계의 (휴지통이 아닌) 카드들 — 옮기는 카드 자신은 빼고 넣는다.
 * targetIndex: 옮긴 뒤 그 단계에서의 자리 (0부터)
 * 간격이 너무 좁아지면 그 단계 카드들의 순서 값을 한 번에 다시 매긴다.
 */
export async function moveCard(
  courseId: string,
  cardId: string,
  toStage: StageId,
  targetSiblings: readonly OrderedItem[],
  targetIndex: number,
): Promise<void> {
  const stageCheck = validateStage(toStage);
  if (!stageCheck.ok) throwValidation(stageCheck.errors);

  const siblings = targetSiblings.filter((item) => item.id !== cardId);
  const plan = planMove(siblings, targetIndex);
  const actor = requireActorEmail();
  const touch = { updatedAt: serverTimestamp(), updatedBy: actor };

  if (plan.updates.length === 0) {
    await runWrite(() =>
      updateDoc(cardDoc(courseId, cardId), { stage: stageCheck.value, order: plan.order, ...touch }),
    );
    return;
  }

  const batch = writeBatch(getDb());
  batch.update(cardDoc(courseId, cardId), { stage: stageCheck.value, order: plan.order, ...touch });
  for (const update of plan.updates) {
    batch.update(cardDoc(courseId, update.id), { order: update.order, ...touch });
  }
  await runWrite(() => batch.commit());
}

/** 휴지통으로 (보드에서 사라지고, 체크리스트는 그대로 남는다) */
export async function softDeleteCard(courseId: string, cardId: string): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(cardDoc(courseId, cardId), {
      deletedAt: serverTimestamp(),
      deletedBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 휴지통에서 되살리기. 원래 단계·순서로 돌아간다. */
export async function restoreCard(courseId: string, cardId: string): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(cardDoc(courseId, cardId), {
      deletedAt: null,
      deletedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}
