import { describe, expect, it } from "vitest";
import {
  MIN_ORDER_GAP,
  ORDER_STEP,
  needsRebalance,
  orderAtEnd,
  orderBetween,
  planMove,
  rebalancedOrders,
  sortByOrder,
} from "@/lib/domain/ordering";

describe("orderBetween", () => {
  it("이웃이 없으면 기본 간격", () => {
    expect(orderBetween(null, null)).toBe(ORDER_STEP);
  });

  it("맨 앞·맨 뒤·가운데", () => {
    expect(orderBetween(null, 1024)).toBe(0);
    expect(orderBetween(1024, null)).toBe(2048);
    expect(orderBetween(1024, 2048)).toBe(1536);
  });
});

describe("orderAtEnd", () => {
  it("빈 목록이면 ORDER_STEP, 아니면 최댓값 + ORDER_STEP", () => {
    expect(orderAtEnd([])).toBe(ORDER_STEP);
    expect(orderAtEnd([10, 3000, 5])).toBe(3000 + ORDER_STEP);
  });
});

describe("sortByOrder", () => {
  it("order 오름차순, 같으면 id 순", () => {
    const sorted = sortByOrder([
      { id: "b", order: 2 },
      { id: "c", order: 1 },
      { id: "a", order: 2 },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});

describe("planMove", () => {
  const siblings = [
    { id: "a", order: 1024 },
    { id: "b", order: 2048 },
    { id: "c", order: 3072 },
  ];

  it("빈 목록으로 옮기면 기본값", () => {
    expect(planMove([], 0)).toEqual({ order: ORDER_STEP, updates: [] });
  });

  it("맨 앞, 가운데, 맨 끝", () => {
    expect(planMove(siblings, 0)).toEqual({ order: 0, updates: [] });
    expect(planMove(siblings, 1)).toEqual({ order: 1536, updates: [] });
    expect(planMove(siblings, 3)).toEqual({ order: 3072 + ORDER_STEP, updates: [] });
  });

  it("범위를 넘는 자리는 끝으로 맞춘다", () => {
    expect(planMove(siblings, 99).order).toBe(3072 + ORDER_STEP);
    expect(planMove(siblings, -5).order).toBe(0);
  });

  it("정렬되지 않은 입력도 순서대로 본다", () => {
    expect(planMove([siblings[2], siblings[0], siblings[1]], 1).order).toBe(1536);
  });

  it("간격이 너무 좁으면 목록 전체를 다시 번호 매긴다", () => {
    const tight = [
      { id: "a", order: 1 },
      { id: "b", order: 1 + MIN_ORDER_GAP },
      { id: "c", order: 5 },
    ];
    expect(needsRebalance(tight[0].order, tight[1].order)).toBe(true);
    const plan = planMove(tight, 1);
    expect(plan.order).toBe(2 * ORDER_STEP);
    expect(plan.updates).toEqual([
      { id: "a", order: 1 * ORDER_STEP },
      { id: "b", order: 3 * ORDER_STEP },
      { id: "c", order: 4 * ORDER_STEP },
    ]);
  });

  it("같은 자리에 계속 끼워 넣어도 순서가 깨지지 않는다", () => {
    let items = [
      { id: "a", order: 1024 },
      { id: "z", order: 2048 },
    ];
    for (let round = 0; round < 80; round += 1) {
      const id = `n${round}`;
      const plan = planMove(items, 1);
      const updated = items.map((item) => {
        const change = plan.updates.find((update) => update.id === item.id);
        return change ? { ...item, order: change.order } : item;
      });
      items = sortByOrder([...updated, { id, order: plan.order }]);
      expect(items[1].id).toBe(id);
    }
    expect(items[0].id).toBe("a");
    expect(items[items.length - 1].id).toBe("z");
  });

  it("rebalancedOrders", () => {
    expect(rebalancedOrders(3)).toEqual([1024, 2048, 3072]);
    expect(rebalancedOrders(0)).toEqual([]);
  });
});
