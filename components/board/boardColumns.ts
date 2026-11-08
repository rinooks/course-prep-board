// 칸반 화면의 칸(단계)별 카드 순서 계산.
// 화면은 "단계 → 카드 id 목록"으로 그린다. 드래그 중에는 이 목록을 직접 바꾸고,
// 저장을 기다리는 이동(pending)은 구독 데이터 위에 덧씌워 화면이 되돌아가 보이지 않게 한다.
// Firebase·React를 쓰지 않는 순수 함수라 tests/unit/board-columns.test.ts가 검사한다.

import { STAGE_IDS, type StageId } from "@/lib/domain/stages";
import { groupCardsByStage } from "@/lib/domain/board";
import type { OrderedItem } from "@/lib/domain/ordering";
import type { Card } from "@/lib/data/types";

/** 단계별 카드 id 목록 (화면 순서) */
export type StageColumns = Record<StageId, string[]>;

type ColumnCard = Pick<Card, "id" | "stage" | "order" | "deletedAt">;

/** 구독한 카드로 칸 목록을 만든다. 휴지통 카드는 빼고, 단계 안에서는 order 순이다. */
export function columnsFromCards(cards: readonly ColumnCard[]): StageColumns {
  const groups = groupCardsByStage(cards);
  const columns = {} as StageColumns;
  for (const stageId of STAGE_IDS) {
    columns[stageId] = groups[stageId].map((card) => card.id);
  }
  return columns;
}

export interface CardPosition {
  stage: StageId;
  /** 그 칸에서의 자리 (0부터) */
  index: number;
}

/** 카드가 어느 칸 몇 번째에 있는지. 없으면 null */
export function findCardPosition(columns: StageColumns, cardId: string): CardPosition | null {
  for (const stageId of STAGE_IDS) {
    const index = columns[stageId].indexOf(cardId);
    if (index !== -1) return { stage: stageId, index };
  }
  return null;
}

export function isSamePosition(a: CardPosition | null, b: CardPosition | null): boolean {
  if (a === null || b === null) return a === b;
  return a.stage === b.stage && a.index === b.index;
}

/** 저장을 기다리는 카드 이동 하나 */
export interface PendingMove {
  cardId: string;
  toStage: StageId;
  toIndex: number;
}

/**
 * 저장을 기다리는 이동을 칸 목록에 덧씌운다.
 * 그사이 지워져 목록에 없는 카드는 건너뛴다. 자리가 범위를 넘으면 맨 끝에 둔다.
 */
export function applyPendingMoves(
  columns: StageColumns,
  moves: readonly PendingMove[],
): StageColumns {
  let result = columns;
  for (const move of moves) {
    const from = findCardPosition(result, move.cardId);
    if (!from) continue;

    const next: StageColumns = { ...result };
    next[from.stage] = result[from.stage].filter((id) => id !== move.cardId);

    const target = [...next[move.toStage]];
    const index = Math.max(0, Math.min(Math.trunc(move.toIndex), target.length));
    target.splice(index, 0, move.cardId);
    next[move.toStage] = target;
    result = next;
  }
  return result;
}

export interface DropPlan {
  stage: StageId;
  /** 옮긴 뒤 자리. 아래 siblings 기준이다 (옮긴 카드는 빼고 센다) */
  index: number;
  /** 옮겨 간 칸의 다른 카드들 (moveCard에 그대로 넘긴다) */
  siblings: OrderedItem[];
}

/**
 * 드래그가 끝난 칸 목록에서 moveCard에 넘길 값을 만든다.
 * 그사이 지워진 카드(cardsById에 없음)는 자리 계산에서 뺀다.
 */
export function planDrop(
  columns: StageColumns,
  cardId: string,
  cardsById: ReadonlyMap<string, Pick<Card, "id" | "order">>,
): DropPlan | null {
  const position = findCardPosition(columns, cardId);
  if (!position) return null;

  const siblings: OrderedItem[] = [];
  let index = 0;
  for (const id of columns[position.stage]) {
    if (id === cardId) {
      index = siblings.length;
      continue;
    }
    const card = cardsById.get(id);
    if (card) siblings.push({ id: card.id, order: card.order });
  }
  return { stage: position.stage, index, siblings };
}
