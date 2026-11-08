"use client";

// 칸반 카드 한 장: 제목, 담당자, 마감일, 체크리스트 진행률, 첨부 파일 수, 끝남 표시.
// 카드를 누르면 상세가 열리고, 끌면 다른 단계로 옮겨진다 (마우스는 5px 이상, 휴대폰은 길게 눌러서).
// 키보드 사용자는 오른쪽 손잡이 버튼에서 스페이스 바로 들고 화살표로 옮긴다.

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing } from "@/components/ui/cn";
import type { Card } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import type { ChecklistCount } from "@/lib/domain/progress";
import type { StageId } from "@/lib/domain/stages";
import { describeDue } from "./cardDisplay";
import { CARD_TYPE, type CardDragData } from "./dndConfig";
import { CheckIcon, GripIcon, ListIcon, NoteIcon, PaperclipIcon, PersonIcon } from "@/components/ui/icons";

interface KanbanCardProps {
  card: Card;
  /** 칸 안에서 지금 보이는 자리 (0부터) */
  index: number;
  stageId: StageId;
  /** 담당자 표시 이름. 없으면 빈 문자열 */
  assigneeLabel: string;
  checklist: ChecklistCount | undefined;
  /** 첨부 파일 수 */
  fileCount: number;
  today: DateString;
  onOpen: (cardId: string) => void;
  onToggleDone: (card: Card) => void;
}

export function KanbanCard({
  card,
  index,
  stageId,
  assigneeLabel,
  checklist,
  fileCount,
  today,
  onOpen,
  onToggleDone,
}: KanbanCardProps) {
  // 화면 낭독기 안내에 카드 제목을 쓰려고 드래그 정보에 담는다
  const data = useMemo<CardDragData>(() => ({ title: card.title }), [card.title]);
  const { ref, handleRef, isDragging } = useSortable({
    id: card.id,
    index,
    group: stageId,
    type: CARD_TYPE,
    accept: CARD_TYPE,
    data,
  });

  const due = describeDue(card.dueDate, today, card.done);
  const checklistDone = checklist !== undefined && checklist.total > 0 && checklist.done === checklist.total;

  return (
    <li
      ref={ref}
      className={cn(
        "rounded-card border bg-white",
        card.done ? "border-success/25" : "border-line",
        isDragging ? "shadow-lg ring-2 ring-primary/40" : "shadow-card",
      )}
    >
      <div className="flex items-start gap-1 p-1">
        {/* data-no-drag(NO_DRAG_ATTRIBUTE): 이 버튼을 누를 때는 끌기를 시작하지 않는다 */}
        <button
          type="button"
          data-no-drag=""
          onClick={() => onToggleDone(card)}
          aria-pressed={card.done}
          aria-label={`"${card.title}" 끝남 표시`}
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button",
            "transition motion-reduce:transition-none hover:bg-ink/5",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full border-2",
              card.done ? "border-success bg-success text-primary-foreground" : "border-muted text-transparent",
            )}
          >
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpen(card.id)}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 flex-col gap-2 rounded-button px-1 py-2.5 text-left",
            "transition motion-reduce:transition-none hover:bg-ink/5",
            focusRing,
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold leading-snug",
              card.done ? "text-muted line-through" : "text-ink",
            )}
          >
            {card.title}
            {card.done ? <span className="sr-only"> (끝남)</span> : null}
          </span>

          {due || checklist || fileCount > 0 || assigneeLabel || card.memo ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {due ? (
                <Badge tone={due.tone}>
                  <span aria-hidden="true">{due.text}</span>
                  <span className="sr-only">{due.description}</span>
                </Badge>
              ) : null}
              {checklist ? (
                <Badge tone={checklistDone ? "success" : "neutral"}>
                  <ListIcon />
                  <span className="sr-only">체크리스트</span>
                  <span className="tabular-nums">
                    {checklist.done}/{checklist.total}
                  </span>
                </Badge>
              ) : null}
              {fileCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted" title={`첨부 파일 ${fileCount}개`}>
                  <PaperclipIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">첨부 파일</span>
                  <span className="tabular-nums">{fileCount}</span>
                  <span className="sr-only">개</span>
                </span>
              ) : null}
              {card.memo ? (
                <span className="inline-flex items-center text-muted" title="메모 있음">
                  <NoteIcon />
                  <span className="sr-only">메모 있음</span>
                </span>
              ) : null}
              {assigneeLabel ? (
                <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted">
                  <PersonIcon />
                  <span className="sr-only">담당자</span>
                  <span className="break-anywhere">{assigneeLabel}</span>
                </span>
              ) : null}
            </span>
          ) : null}
        </button>

        <button
          ref={handleRef}
          type="button"
          aria-label={`"${card.title}" 카드 옮기기`}
          aria-roledescription="옮길 수 있는 카드"
          className={cn(
            "inline-flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-button text-muted",
            "transition motion-reduce:transition-none hover:bg-ink/5 hover:text-ink active:cursor-grabbing",
            focusRing,
          )}
        >
          <GripIcon />
        </button>
      </div>
    </li>
  );
}
