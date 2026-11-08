// 보드 화면용 묶기·정렬. 휴지통 카드는 빼고, 단계별·카드별로 순서대로 묶는다.

import { STAGE_IDS, type StageId } from "./stages";
import { sortByOrder } from "./ordering";
import type { Card, ChecklistItem } from "@/lib/data/types";

type BoardCard = Pick<Card, "id" | "stage" | "order" | "deletedAt">;
type BoardItem = Pick<ChecklistItem, "id" | "cardId" | "order">;

/** 휴지통에 없는 카드만 */
export function visibleCards<T extends Pick<Card, "deletedAt">>(cards: readonly T[]): T[] {
  return cards.filter((card) => card.deletedAt === null);
}

/** 휴지통에 있는 카드만 (최근에 지운 순) */
export function trashedCards<T extends Pick<Card, "deletedAt">>(cards: readonly T[]): T[] {
  return cards
    .filter((card) => card.deletedAt !== null)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

/** 7단계 모두 키가 있는 객체. 각 단계 카드는 order 순 */
export function groupCardsByStage<T extends BoardCard>(cards: readonly T[]): Record<StageId, T[]> {
  const groups = Object.fromEntries(STAGE_IDS.map((id) => [id, [] as T[]])) as Record<StageId, T[]>;
  for (const card of visibleCards(cards)) {
    groups[card.stage]?.push(card);
  }
  for (const stageId of STAGE_IDS) {
    groups[stageId] = sortByOrder(groups[stageId]);
  }
  return groups;
}

/** 카드 id → 그 카드의 체크리스트 항목 (order 순) */
export function groupChecklistByCard<T extends BoardItem>(
  items: readonly T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    (groups[item.cardId] ??= []).push(item);
  }
  for (const cardId of Object.keys(groups)) {
    groups[cardId] = sortByOrder(groups[cardId]);
  }
  return groups;
}
