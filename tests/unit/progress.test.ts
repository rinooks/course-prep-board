import { describe, expect, it } from "vitest";
import { checklistProgressByCard, summarizeCourse, summarizeProgress } from "@/lib/domain/progress";
import { groupCardsByStage, groupChecklistByCard, trashedCards, visibleCards } from "@/lib/domain/board";
import { makeCard, makeItem, makeSession } from "./fixtures";

describe("summarizeProgress", () => {
  it("카드가 없으면 0%, 현재 단계 없음", () => {
    const progress = summarizeProgress([]);
    expect(progress.totalCards).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.currentStageId).toBeNull();
    expect(progress.allDone).toBe(false);
    expect(progress.stages).toHaveLength(7);
    expect(progress.stages.every((stage) => !stage.complete)).toBe(true);
  });

  it("현재 단계 = 순서상 처음으로 안 끝난 카드가 있는 단계", () => {
    const cards = [
      makeCard({ id: "1", stage: "request", done: true }),
      makeCard({ id: "2", stage: "curriculum", done: true }),
      makeCard({ id: "3", stage: "curriculum", done: false }),
      makeCard({ id: "4", stage: "lecture", done: false }),
    ];
    const progress = summarizeProgress(cards);
    expect(progress.currentStageId).toBe("curriculum");
    expect(progress.doneCards).toBe(2);
    expect(progress.totalCards).toBe(4);
    expect(progress.percent).toBe(50);
    expect(progress.stages[0]).toMatchObject({ stageId: "request", total: 1, done: 1, complete: true });
    expect(progress.stages[1]).toMatchObject({ stageId: "curriculum", total: 2, done: 1, complete: false });
    // 카드가 없는 단계는 완료가 아니다
    expect(progress.stages[3]).toMatchObject({ stageId: "practice", total: 0, complete: false });
  });

  it("휴지통 카드는 세지 않는다", () => {
    const cards = [
      makeCard({ id: "1", stage: "request", done: true }),
      makeCard({ id: "2", stage: "request", done: false, deletedAt: 123 }),
    ];
    const progress = summarizeProgress(cards);
    expect(progress.totalCards).toBe(1);
    expect(progress.allDone).toBe(true);
    expect(progress.currentStageId).toBeNull();
    expect(progress.percent).toBe(100);
  });

  it("퍼센트는 내림한 정수", () => {
    const cards = [
      makeCard({ id: "1", done: true }),
      makeCard({ id: "2", done: false }),
      makeCard({ id: "3", done: false }),
    ];
    expect(summarizeProgress(cards).percent).toBe(33);
  });
});

describe("checklistProgressByCard", () => {
  it("카드별 끝낸 항목 / 전체", () => {
    const items = [
      makeItem({ id: "i1", cardId: "c1", done: true }),
      makeItem({ id: "i2", cardId: "c1", done: false }),
      makeItem({ id: "i3", cardId: "c2", done: true }),
    ];
    expect(checklistProgressByCard(items)).toEqual({
      c1: { done: 1, total: 2 },
      c2: { done: 1, total: 1 },
    });
  });
});

describe("summarizeCourse", () => {
  it("휴지통 카드의 체크리스트는 빼고, 다음 회차를 고른다", () => {
    const summary = summarizeCourse({
      cards: [makeCard({ id: "c1" }), makeCard({ id: "c2", deletedAt: 5 })],
      checklistItems: [
        makeItem({ id: "i1", cardId: "c1", done: true }),
        makeItem({ id: "i2", cardId: "c2", done: true }),
      ],
      sessions: [
        makeSession({ id: "s1", date: "2026-10-01" }),
        makeSession({ id: "s2", date: "2026-10-20" }),
        makeSession({ id: "s3", date: "2026-10-15" }),
      ],
      today: "2026-10-11",
    });
    expect(summary.checklist).toEqual({ c1: { done: 1, total: 1 } });
    expect(summary.nextSession?.id).toBe("s3");
    expect(summary.progress.totalCards).toBe(1);
  });
});

describe("board 묶기", () => {
  it("groupCardsByStage: 7단계 키, 휴지통 제외, 순서대로", () => {
    const groups = groupCardsByStage([
      makeCard({ id: "b", stage: "lecture", order: 2 }),
      makeCard({ id: "a", stage: "lecture", order: 1 }),
      makeCard({ id: "x", stage: "lecture", order: 0, deletedAt: 1 }),
    ]);
    expect(Object.keys(groups)).toHaveLength(7);
    expect(groups.lecture.map((card) => card.id)).toEqual(["a", "b"]);
    expect(groups.request).toEqual([]);
  });

  it("groupChecklistByCard: 카드별, 순서대로", () => {
    const groups = groupChecklistByCard([
      makeItem({ id: "2", cardId: "c1", order: 20 }),
      makeItem({ id: "1", cardId: "c1", order: 10 }),
      makeItem({ id: "3", cardId: "c2", order: 5 }),
    ]);
    expect(groups.c1.map((item) => item.id)).toEqual(["1", "2"]);
    expect(groups.c2.map((item) => item.id)).toEqual(["3"]);
  });

  it("visibleCards / trashedCards", () => {
    const cards = [
      makeCard({ id: "1" }),
      makeCard({ id: "2", deletedAt: 10 }),
      makeCard({ id: "3", deletedAt: 30 }),
    ];
    expect(visibleCards(cards).map((card) => card.id)).toEqual(["1"]);
    expect(trashedCards(cards).map((card) => card.id)).toEqual(["3", "2"]);
  });
});
