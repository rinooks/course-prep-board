// 과정 진행 상황 계산: 현재 단계, 끝낸 카드 수, 단계별 완료, 카드별 체크리스트 진행률.

import { STAGES, type StageId } from "./stages";
import { visibleCards } from "./board";
import { nextSession } from "./schedule";
import type { DateString } from "./dates";
import type { Card, ChecklistItem, Session } from "@/lib/data/types";

type ProgressCard = Pick<Card, "id" | "stage" | "done" | "deletedAt">;
type ProgressItem = Pick<ChecklistItem, "cardId" | "done">;

export interface StageProgress {
  stageId: StageId;
  label: string;
  total: number;
  done: number;
  /** 카드가 1장 이상 있고 모두 끝났으면 true. 카드가 없는 단계는 false */
  complete: boolean;
}

export interface CourseProgress {
  stages: StageProgress[];
  totalCards: number;
  doneCards: number;
  /** 0~100 정수. 카드가 없으면 0 */
  percent: number;
  /** 순서상 처음으로 안 끝난 카드가 있는 단계. 모두 끝났거나 카드가 없으면 null */
  currentStageId: StageId | null;
  /** 카드가 있고 전부 끝났으면 true */
  allDone: boolean;
}

export function summarizeProgress(cards: readonly ProgressCard[]): CourseProgress {
  const live = visibleCards(cards);
  const stages: StageProgress[] = STAGES.map((stage) => {
    const stageCards = live.filter((card) => card.stage === stage.id);
    const done = stageCards.filter((card) => card.done).length;
    return {
      stageId: stage.id,
      label: stage.label,
      total: stageCards.length,
      done,
      complete: stageCards.length > 0 && done === stageCards.length,
    };
  });

  const totalCards = live.length;
  const doneCards = live.filter((card) => card.done).length;
  const current = stages.find((stage) => stage.done < stage.total);

  return {
    stages,
    totalCards,
    doneCards,
    percent: totalCards === 0 ? 0 : Math.floor((doneCards / totalCards) * 100),
    currentStageId: current ? current.stageId : null,
    allDone: totalCards > 0 && doneCards === totalCards,
  };
}

export interface ChecklistCount {
  done: number;
  total: number;
}

/** 카드 id → 체크리스트 진행률 (예: 3/5). 항목이 없는 카드는 키가 없다 */
export function checklistProgressByCard(
  items: readonly ProgressItem[],
): Record<string, ChecklistCount> {
  const result: Record<string, ChecklistCount> = {};
  for (const item of items) {
    const count = (result[item.cardId] ??= { done: 0, total: 0 });
    count.total += 1;
    if (item.done) count.done += 1;
  }
  return result;
}

export interface CourseSummary {
  progress: CourseProgress;
  checklist: Record<string, ChecklistCount>;
  /** 오늘 이후(오늘 포함) 가장 가까운 회차 */
  nextSession: Session | null;
}

export function summarizeCourse(input: {
  cards: readonly Card[];
  checklistItems?: readonly ChecklistItem[];
  sessions: readonly Session[];
  today: DateString;
}): CourseSummary {
  const liveCardIds = new Set(visibleCards(input.cards).map((card) => card.id));
  const liveItems = (input.checklistItems ?? []).filter((item) => liveCardIds.has(item.cardId));
  return {
    progress: summarizeProgress(input.cards),
    checklist: checklistProgressByCard(liveItems),
    nextSession: nextSession(input.sessions, input.today),
  };
}
