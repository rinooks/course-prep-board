import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE,
  STAGES,
  STAGE_IDS,
  getStage,
  isStageId,
  nextStageId,
  previousStageId,
  stageIndex,
  stageLabel,
} from "@/lib/domain/stages";
import { LIMITS } from "@/lib/domain/validation";

describe("STAGES", () => {
  it("PRD의 7단계를 순서대로 담는다", () => {
    expect(STAGES.map((stage) => stage.label)).toEqual([
      "고객사 요청 확인",
      "커리큘럼",
      "교안",
      "실습 자료",
      "리허설",
      "당일 준비물",
      "사후 설문",
    ]);
    expect(STAGES.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("id는 저장되는 값이라 바뀌면 안 된다", () => {
    expect(STAGE_IDS).toEqual(["request", "curriculum", "lecture", "practice", "rehearsal", "dayof", "survey"]);
  });

  it("도우미 함수", () => {
    expect(isStageId("lecture")).toBe(true);
    expect(isStageId("unknown")).toBe(false);
    expect(isStageId(3)).toBe(false);
    expect(stageLabel("dayof")).toBe("당일 준비물");
    expect(getStage("survey").order).toBe(7);
    expect(stageIndex("request")).toBe(0);
    expect(nextStageId("request")).toBe("curriculum");
    expect(nextStageId("survey")).toBeNull();
    expect(previousStageId("request")).toBeNull();
    expect(previousStageId("curriculum")).toBe("request");
  });

  it("알 수 없는 단계는 오류", () => {
    expect(() => getStage("nope" as never)).toThrow();
  });
});

describe("DEFAULT_TEMPLATE", () => {
  it("모든 단계에 기본 카드가 있다", () => {
    for (const stageId of STAGE_IDS) {
      expect(DEFAULT_TEMPLATE.some((card) => card.stage === stageId)).toBe(true);
    }
  });

  it("PRD 부록의 카드 수와 같다 (3·3·3·4·3·4·3)", () => {
    const counts = STAGE_IDS.map((stageId) => DEFAULT_TEMPLATE.filter((card) => card.stage === stageId).length);
    expect(counts).toEqual([3, 3, 3, 4, 3, 4, 3]);
  });

  it("묶여 있던 항목은 체크리스트로 풀었다", () => {
    const info = DEFAULT_TEMPLATE.find((card) => card.title === "교육 정보 확인");
    expect(info?.checklist).toEqual(["대상", "인원", "시간", "장소"]);
    const laptop = DEFAULT_TEMPLATE.find((card) => card.stage === "dayof" && card.title.startsWith("노트북"));
    expect(laptop?.checklist).toEqual(["노트북", "충전기", "어댑터"]);
  });

  it("제목·항목 길이가 저장 제한 안이고, 카드 안 항목이 겹치지 않는다", () => {
    for (const card of DEFAULT_TEMPLATE) {
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.title.length).toBeLessThanOrEqual(LIMITS.cardTitle);
      expect(new Set(card.checklist).size).toBe(card.checklist.length);
      for (const text of card.checklist) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(LIMITS.checklistText);
      }
    }
  });

  it("한 번의 묶음 쓰기(최대 500건) 안에 들어간다", () => {
    const writes =
      1 + DEFAULT_TEMPLATE.length + DEFAULT_TEMPLATE.reduce((sum, card) => sum + card.checklist.length, 0);
    expect(writes + 20).toBeLessThan(500);
  });
});
