"use client";

// 칸반 보드: 7단계 칸을 가로로 늘어놓고, 카드를 끌어서 다른 단계로 옮기거나 순서를 바꾼다.
// - 끄는 동안에는 화면 속 순서(dragColumns)만 바꾼다.
// - 놓으면 옮긴 카드 하나의 단계·순서만 저장한다 (moveCard). 저장을 기다리는 동안에도
//   화면이 원래 자리로 튀지 않게 pendingMoves를 덧씌운다.
// - 저장이 실패하면 덧씌운 것을 지워 원래 자리로 돌아가고, 다음 할 일을 알림으로 보여준다.

import { useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import { moveCard, setCardDone } from "@/lib/data/cards";
import { labelForEmail } from "@/lib/data/members";
import type { Card, CardFile, ChecklistItem, Member } from "@/lib/data/types";
import { isTimeoutError } from "@/lib/domain/async";
import { visibleCards } from "@/lib/domain/board";
import { countFilesByCard } from "@/lib/domain/cardFiles";
import type { DateString } from "@/lib/domain/dates";
import { toUserMessage } from "@/lib/domain/errors";
import { checklistProgressByCard, summarizeProgress } from "@/lib/domain/progress";
import { STAGES } from "@/lib/domain/stages";
import {
  applyPendingMoves,
  columnsFromCards,
  findCardPosition,
  isSamePosition,
  planDrop,
  type PendingMove,
  type StageColumns,
} from "./boardColumns";
import { boardPlugins, boardSensors, CARD_TYPE } from "./dndConfig";
import { KanbanColumn } from "./KanbanColumn";

/** 카드 이동 저장 실패 안내 */
function moveFailureMessage(error: unknown): string {
  if (isTimeoutError(error)) {
    // 시간 초과는 기기 안에는 반영된 상태라 화면은 옮긴 자리에 남는다
    return "카드 이동이 아직 서버에 저장되지 않았습니다. 인터넷 연결을 확인해 주세요. 연결되면 자동으로 저장되지만, 그 전에 창을 닫으면 사라질 수 있습니다.";
  }
  return `카드를 옮기지 못해 원래 자리로 되돌렸습니다. ${toUserMessage(error)}`;
}

interface KanbanBoardProps {
  courseId: string;
  /** 과정의 모든 카드 (휴지통 포함) */
  cards: readonly Card[];
  checklistItems: readonly ChecklistItem[];
  /** 과정의 첨부 파일 목록 (카드마다 개수를 보여준다) */
  cardFiles: readonly CardFile[];
  members: readonly Member[];
  today: DateString;
  onOpenCard: (cardId: string) => void;
}

export function KanbanBoard({
  courseId,
  cards,
  checklistItems,
  cardFiles,
  members,
  today,
  onOpenCard,
}: KanbanBoardProps) {
  const toast = useToast();
  const [dragColumns, setDragColumns] = useState<StageColumns | null>(null);
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
  // 드래그 이벤트 안에서 최신 값을 바로 읽으려고 ref에도 둔다
  const dragColumnsRef = useRef<StageColumns | null>(null);
  const dragStartRef = useRef<StageColumns | null>(null);

  const liveCards = useMemo(() => visibleCards(cards), [cards]);
  const cardsById = useMemo(() => new Map(liveCards.map((card) => [card.id, card])), [liveCards]);
  const baseColumns = useMemo(
    () => applyPendingMoves(columnsFromCards(liveCards), pendingMoves),
    [liveCards, pendingMoves],
  );
  const columns = dragColumns ?? baseColumns;

  const progress = useMemo(() => summarizeProgress(cards), [cards]);
  const checklistByCard = useMemo(() => {
    const liveIds = new Set(liveCards.map((card) => card.id));
    return checklistProgressByCard(checklistItems.filter((item) => liveIds.has(item.cardId)));
  }, [checklistItems, liveCards]);
  const fileCountByCard = useMemo(() => countFilesByCard(cardFiles), [cardFiles]);

  function assigneeLabelOf(email: string | null): string {
    return email ? labelForEmail(email, members) : "";
  }

  function handleDragStart() {
    dragStartRef.current = baseColumns;
    dragColumnsRef.current = baseColumns;
    setDragColumns(baseColumns);
  }

  function handleDragOver(event: DragOverEvent) {
    const { source } = event.operation;
    if (!source || source.type !== CARD_TYPE) return;
    const current = dragColumnsRef.current;
    if (!current) return;
    const next = move(current, event);
    if (next === current) return;
    dragColumnsRef.current = next;
    setDragColumns(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const finalColumns = dragColumnsRef.current;
    const startColumns = dragStartRef.current;
    dragColumnsRef.current = null;
    dragStartRef.current = null;
    setDragColumns(null);

    const { source } = event.operation;
    if (event.canceled || !source || !finalColumns || !startColumns) return;

    const cardId = String(source.id);
    const before = findCardPosition(startColumns, cardId);
    const after = findCardPosition(finalColumns, cardId);
    if (isSamePosition(before, after)) return;

    const plan = planDrop(finalColumns, cardId, cardsById);
    if (!plan) return;
    saveMove(cardId, plan.stage, plan.siblings, plan.index);
  }

  function saveMove(
    cardId: string,
    toStage: PendingMove["toStage"],
    siblings: { id: string; order: number }[],
    toIndex: number,
  ) {
    const pending: PendingMove = { cardId, toStage, toIndex };
    setPendingMoves((current) => [...current.filter((item) => item.cardId !== cardId), pending]);

    moveCard(courseId, cardId, toStage, siblings, toIndex)
      .catch((error: unknown) => {
        toast.error(moveFailureMessage(error));
      })
      .finally(() => {
        setPendingMoves((current) => current.filter((item) => item !== pending));
      });
  }

  function handleToggleDone(card: Card) {
    setCardDone(courseId, card.id, !card.done).catch((error: unknown) => {
      toast.error(toUserMessage(error));
    });
  }

  return (
    <DragDropProvider
      sensors={boardSensors}
      plugins={boardPlugins}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        role="region"
        aria-label="단계별 카드. 화면이 좁으면 옆으로 밀어서 다른 단계를 볼 수 있습니다."
        tabIndex={0}
        // relative: 칸 안의 화면 낭독기용 숨은 글자(sr-only, absolute)가 이 스크롤 상자를 빠져나가
        // 페이지 전체에 가로 스크롤을 만들지 않도록 기준점을 여기에 둔다
        // -mx: 칸반 타일의 안쪽 여백만큼 넓혀 옆으로 밀 때 카드가 타일 끝까지 보이게 한다
        className={cn("relative -mx-4 overflow-x-auto px-4 pb-2 md:-mx-5 md:px-5", focusRing)}
      >
        <ol className="flex items-stretch gap-3">
          {STAGES.map((stage, stageIndex) => {
            const stageCards = columns[stage.id]
              .map((id) => cardsById.get(id))
              .filter((card): card is Card => card !== undefined);
            return (
              <KanbanColumn
                key={stage.id}
                courseId={courseId}
                stage={stage}
                cards={stageCards}
                progress={progress.stages[stageIndex]}
                checklistByCard={checklistByCard}
                fileCountByCard={fileCountByCard}
                assigneeLabelOf={assigneeLabelOf}
                today={today}
                onOpenCard={onOpenCard}
                onToggleDone={handleToggleDone}
              />
            );
          })}
        </ol>
      </div>
    </DragDropProvider>
  );
}
