import { describe, expect, it } from "vitest";
import { copyTitle, copyWriteCount, MAX_COPY_WRITES, planCourseCopy } from "@/lib/domain/courseCopy";
import { makeCard, makeItem } from "./fixtures";

describe("planCourseCopy", () => {
  const cards = [
    makeCard({ id: "c2", stage: "curriculum", title: "커리큘럼 초안", order: 512 }),
    makeCard({ id: "r2", stage: "request", title: "두 번째", order: 3000.5, assigneeEmail: "a@example.com" }),
    makeCard({ id: "r1", stage: "request", title: "첫 번째", order: 10, memo: "메모 유지", done: true, dueDate: "2026-10-01" }),
    makeCard({ id: "trash", stage: "request", title: "지운 카드", order: 1, deletedAt: 5 }),
  ];
  const items = [
    makeItem({ id: "i2", cardId: "r1", text: "둘", order: 2048, done: true }),
    makeItem({ id: "i1", cardId: "r1", text: "하나", order: 100 }),
    makeItem({ id: "blank", cardId: "r1", text: "   " }),
    makeItem({ id: "t1", cardId: "trash", text: "지운 카드의 항목" }),
  ];

  it("단계 순·보드 순서대로 복사하고, 휴지통 카드와 빈 항목은 뺀다", () => {
    const plans = planCourseCopy(cards, items, { keepAssignees: true });
    expect(plans.map((plan) => plan.title)).toEqual(["첫 번째", "두 번째", "커리큘럼 초안"]);
    expect(plans.map((plan) => plan.order)).toEqual([1024, 2048, 1024]);
    expect(plans[0].checklist).toEqual([
      { text: "하나", order: 1024 },
      { text: "둘", order: 2048 },
    ]);
  });

  it("메모는 남기고, 담당자는 옵션에 따라 남기거나 비운다", () => {
    const kept = planCourseCopy(cards, items, { keepAssignees: true });
    expect(kept[0].memo).toBe("메모 유지");
    expect(kept[1].assigneeEmail).toBe("a@example.com");

    const cleared = planCourseCopy(cards, items, { keepAssignees: false });
    expect(cleared.every((plan) => plan.assigneeEmail === null)).toBe(true);
  });

  it("저장할 문서 수는 과정 1 + 카드 + 체크리스트", () => {
    const plans = planCourseCopy(cards, items, { keepAssignees: true });
    expect(copyWriteCount(plans)).toBe(1 + 3 + 2);
    expect(MAX_COPY_WRITES).toBe(500);
  });
});

describe("copyTitle", () => {
  it("이름 뒤에 (복사본)을 붙인다", () => {
    expect(copyTitle("  A사 입문 과정 ", 100)).toBe("A사 입문 과정 (복사본)");
  });

  it("길이 제한을 넘으면 앞부분을 줄인다", () => {
    const result = copyTitle("가".repeat(100), 100);
    expect(result).toHaveLength(100);
    expect(result.endsWith(" (복사본)")).toBe(true);
  });
});
