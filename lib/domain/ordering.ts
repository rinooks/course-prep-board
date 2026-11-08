// 카드·체크리스트의 순서 값 계산.
// 순서는 소수(fractional) 숫자로 두어, 하나를 옮길 때 그 문서 하나만 고치면 되게 한다.
// 같은 자리에 계속 끼워 넣어 간격이 너무 좁아지면 그 목록 전체를 다시 번호 매긴다(rebalance).

export const ORDER_STEP = 1024;
export const MIN_ORDER_GAP = 1e-6;

export interface OrderedItem {
  id: string;
  order: number;
}

/** order 오름차순, 같으면 id 순으로 정렬한 새 배열 */
export function sortByOrder<T extends OrderedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** 두 이웃 사이의 순서 값. 이웃이 없으면 null */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return ORDER_STEP;
  if (before === null) return (after as number) - ORDER_STEP;
  if (after === null) return before + ORDER_STEP;
  return (before + after) / 2;
}

/** 목록 맨 끝에 붙일 순서 값 */
export function orderAtEnd(orders: readonly number[]): number {
  if (orders.length === 0) return ORDER_STEP;
  return Math.max(...orders) + ORDER_STEP;
}

/** 두 이웃 사이가 너무 좁아 다시 번호를 매겨야 하는지 */
export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  return after - before < MIN_ORDER_GAP * 2;
}

/** count개를 고른 간격으로 다시 번호 매긴 값 */
export function rebalancedOrders(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * ORDER_STEP);
}

export interface MovePlan {
  /** 옮기는 항목의 새 순서 값 */
  order: number;
  /** 간격이 좁아 함께 고쳐야 하는 다른 항목들. 보통은 빈 배열 */
  updates: OrderedItem[];
}

/**
 * 옮길 위치의 순서 값을 계산한다.
 * siblings: 옮겨 갈 목록의 항목들(옮기는 항목 자신은 빼고). 정렬되지 않아도 된다.
 * targetIndex: 옮긴 뒤 목록에서 차지할 자리(0부터). 범위를 넘으면 끝으로 맞춘다.
 */
export function planMove(siblings: readonly OrderedItem[], targetIndex: number): MovePlan {
  const sorted = sortByOrder(siblings);
  const index = Math.max(0, Math.min(Math.trunc(targetIndex), sorted.length));
  const before = index > 0 ? sorted[index - 1].order : null;
  const after = index < sorted.length ? sorted[index].order : null;

  if (!needsRebalance(before, after)) {
    return { order: orderBetween(before, after), updates: [] };
  }

  const fresh = rebalancedOrders(sorted.length + 1);
  const updates: OrderedItem[] = [];
  let movedOrder = fresh[index];
  let slot = 0;
  for (let position = 0; position < fresh.length; position += 1) {
    if (position === index) {
      movedOrder = fresh[position];
      continue;
    }
    const item = sorted[slot];
    slot += 1;
    if (item.order !== fresh[position]) {
      updates.push({ id: item.id, order: fresh[position] });
    }
  }
  return { order: movedOrder, updates };
}
