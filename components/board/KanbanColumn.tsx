"use client";

// 칸반의 칸(단계) 하나: 머리글(단계 이름, 끝낸 카드/전체, 완료 표시) + 카드 목록 + 카드 추가.
// 칸 전체가 놓을 자리라서 빈 칸에도 카드를 끌어다 놓을 수 있다.

import { useDroppable } from "@dnd-kit/react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { StageNumber } from "@/components/course/StageNumber";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import type { Card } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import type { ChecklistCount, StageProgress } from "@/lib/domain/progress";
import type { Stage } from "@/lib/domain/stages";
import { AddCardForm } from "./AddCardForm";
import { CARD_TYPE, COLUMN_TYPE } from "./dndConfig";
import { CheckIcon } from "@/components/ui/icons";
import { KanbanCard } from "./KanbanCard";
import { stageColumnId } from "./StageJumpNav";

interface KanbanColumnProps {
  courseId: string;
  stage: Stage;
  /** 화면 순서대로 정렬된 이 칸의 카드 */
  cards: readonly Card[];
  progress: StageProgress;
  checklistByCard: Record<string, ChecklistCount>;
  /** 카드 id → 첨부 파일 수 */
  fileCountByCard: Record<string, number>;
  assigneeLabelOf: (email: string | null) => string;
  today: DateString;
  onOpenCard: (cardId: string) => void;
  onToggleDone: (card: Card) => void;
}

export function KanbanColumn({
  courseId,
  stage,
  cards,
  progress,
  checklistByCard,
  fileCountByCard,
  assigneeLabelOf,
  today,
  onOpenCard,
  onToggleDone,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    type: COLUMN_TYPE,
    accept: CARD_TYPE,
    // 카드 위에 겹치면 카드 쪽이 먼저다. 카드가 없는 곳에서만 칸이 받는다
    collisionPriority: CollisionPriority.Low,
  });

  const headingId = `stage-${stage.id}-heading`;

  return (
    <li
      ref={ref}
      id={stageColumnId(stage.id)}
      // 단계 바로가기(StageJumpNav)가 여기로 스크롤하고 초점을 옮긴다
      tabIndex={-1}
      aria-labelledby={headingId}
      className={cn(
        "flex w-[85vw] max-w-80 shrink-0 scroll-mt-20 scroll-ml-4 flex-col rounded-card border focus:outline-none md:w-72 md:scroll-ml-5",
        // 카드를 끌어 이 칸 위에 올리면 테두리와 바탕이 은은하게 바뀐다
        "transition-colors motion-reduce:transition-none",
        isDropTarget ? "border-primary/50 bg-primary/5" : "border-line bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-2 rounded-t-card border-b border-line bg-white px-3 py-2.5">
        <h3 id={headingId} className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight text-ink">
          <StageNumber order={stage.order} />
          <span>{stage.label}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {progress.complete ? (
            <Badge tone="success">
              <CheckIcon className="h-3.5 w-3.5" />
              완료
            </Badge>
          ) : null}
          <span className="text-sm font-semibold text-muted tabular-nums">
            <span aria-hidden="true">
              {progress.done}/{progress.total}
            </span>
            <span className="sr-only">
              카드 {progress.total}장 중 {progress.done}장 끝남
            </span>
          </span>
        </div>
      </div>

      <ul className="flex min-h-20 flex-col gap-2 p-2" aria-label={`${stage.label} 단계 카드`}>
        {cards.map((card, index) => (
          <KanbanCard
            key={card.id}
            card={card}
            index={index}
            stageId={stage.id}
            assigneeLabel={assigneeLabelOf(card.assigneeEmail)}
            checklist={checklistByCard[card.id]}
            fileCount={fileCountByCard[card.id] ?? 0}
            today={today}
            onOpen={onOpenCard}
            onToggleDone={onToggleDone}
          />
        ))}
        {cards.length === 0 ? (
          <li>
            <EmptyState size="sm" title="카드가 없습니다" description="아래에서 추가하거나 다른 단계에서 끌어다 놓으세요." />
          </li>
        ) : null}
      </ul>

      <div className="mt-auto border-t border-line p-2">
        <AddCardForm
          courseId={courseId}
          stageId={stage.id}
          stageLabel={stage.label}
          orders={cards.map((card) => card.order)}
        />
      </div>
    </li>
  );
}
