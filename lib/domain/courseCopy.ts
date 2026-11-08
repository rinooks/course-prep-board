// 과정 복제 계획: 원래 과정의 카드·체크리스트에서 무엇을 어떤 순서로 복사할지 정한다. 순수 함수.
// 실제 저장은 lib/data/courses.ts의 duplicateCourse가 한다.

import type { Card, ChecklistItem } from "@/lib/data/types";
import { rebalancedOrders } from "./ordering";
import { STAGE_IDS, type StageId } from "./stages";

/** Firestore 묶음 쓰기 한 번에 넣을 수 있는 문서 수 (과정 1개 포함) */
export const MAX_COPY_WRITES = 500;

export interface CopyChecklistPlan {
  text: string;
  order: number;
}

export interface CopyCardPlan {
  stage: StageId;
  title: string;
  order: number;
  memo: string;
  /** keepAssignees가 false면 null */
  assigneeEmail: string | null;
  checklist: CopyChecklistPlan[];
}

export interface CopyOptions {
  /** 카드 담당자를 그대로 둘지 (같은 팀이 같은 일을 맡는 경우가 많다) */
  keepAssignees: boolean;
}

type SourceCard = Pick<Card, "id" | "stage" | "title" | "order" | "memo" | "assigneeEmail" | "deletedAt">;
type SourceItem = Pick<ChecklistItem, "id" | "cardId" | "text" | "order">;

function byOrderThenId<T extends { order: number; id: string }>(a: T, b: T): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 복사할 카드 목록 (단계 순, 단계 안에서는 지금 보드 순서).
 * - 휴지통 카드와 그 체크리스트는 뺀다
 * - 끝냄 표시·체크·마감일은 비운다 (새 과정은 처음부터 다시 진행한다)
 * - 순서 값은 1024 간격으로 다시 매긴다 (그동안 끌어 옮기며 생긴 소수 순서를 정리)
 */
export function planCourseCopy(
  cards: readonly SourceCard[],
  items: readonly SourceItem[],
  options: CopyOptions,
): CopyCardPlan[] {
  const itemsByCard = new Map<string, SourceItem[]>();
  for (const item of items) {
    if (item.text.trim().length === 0) continue;
    const list = itemsByCard.get(item.cardId) ?? [];
    list.push(item);
    itemsByCard.set(item.cardId, list);
  }

  const plans: CopyCardPlan[] = [];
  for (const stageId of STAGE_IDS) {
    const stageCards = cards
      .filter((card) => card.stage === stageId && card.deletedAt === null)
      .sort(byOrderThenId);
    const cardOrders = rebalancedOrders(stageCards.length);

    stageCards.forEach((card, cardIndex) => {
      const cardItems = (itemsByCard.get(card.id) ?? []).sort(byOrderThenId);
      const itemOrders = rebalancedOrders(cardItems.length);
      plans.push({
        stage: stageId,
        title: card.title,
        order: cardOrders[cardIndex],
        memo: card.memo,
        assigneeEmail: options.keepAssignees ? card.assigneeEmail : null,
        checklist: cardItems.map((item, itemIndex) => ({ text: item.text, order: itemOrders[itemIndex] })),
      });
    });
  }
  return plans;
}

/** 저장할 문서 수: 과정 1 + 카드 + 체크리스트 */
export function copyWriteCount(plans: readonly CopyCardPlan[]): number {
  return 1 + plans.reduce((total, plan) => total + 1 + plan.checklist.length, 0);
}

/** 복사본 기본 이름. 과정 이름 길이 제한(limit)을 넘지 않게 앞부분을 줄인다 */
export function copyTitle(title: string, limit: number): string {
  const suffix = " (복사본)";
  const base = title.trim();
  if (base.length + suffix.length <= limit) return `${base}${suffix}`;
  return `${base.slice(0, Math.max(0, limit - suffix.length)).trimEnd()}${suffix}`;
}
