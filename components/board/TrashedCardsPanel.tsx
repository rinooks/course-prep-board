"use client";

// 보드 아래 "삭제한 카드" 목록. 접어 두었다가 펼쳐서 되살린다.
// 지운 카드가 없으면 아무것도 보이지 않는다.

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card as Panel } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import { restoreCard } from "@/lib/data/cards";
import { labelForEmail } from "@/lib/data/members";
import type { Card, Member } from "@/lib/data/types";
import { trashedCards } from "@/lib/domain/board";
import { formatDateKo, todayInSeoul } from "@/lib/domain/dates";
import { toUserMessage } from "@/lib/domain/errors";
import { stageLabel } from "@/lib/domain/stages";

interface TrashedCardsPanelProps {
  courseId: string;
  cards: readonly Card[];
  members: readonly Member[];
}

/** 지운 시각(밀리초) → "10월 11일 (일)" */
function deletedDateLabel(deletedAt: number | null): string {
  if (deletedAt === null) return "";
  return formatDateKo(todayInSeoul(new Date(deletedAt)));
}

export function TrashedCardsPanel({ courseId, cards, members }: TrashedCardsPanelProps) {
  const toast = useToast();
  const titleId = useId();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const trashed = trashedCards(cards);

  if (trashed.length === 0) return null;

  async function handleRestore(card: Card) {
    setRestoringId(card.id);
    try {
      await restoreCard(courseId, card.id);
      toast.success(`'${card.title}' 카드를 '${stageLabel(card.stage)}' 단계로 되살렸습니다.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    // 접힌 줄의 제목("삭제한 카드 N장")을 구역 이름으로 쓴다
    <section aria-labelledby={titleId}>
      <Panel padding="none">
        <details className="group">
          <summary
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-tile px-4 py-2 group-open:rounded-b-none",
              "[&::-webkit-details-marker]:hidden",
              "transition hover:bg-ink/5 motion-reduce:transition-none",
              focusRing,
            )}
          >
            <span id={titleId} className="text-base font-semibold text-ink">
              삭제한 카드{" "}
              <span className="ml-1 text-sm font-semibold text-muted tabular-nums">{trashed.length}장</span>
            </span>
            <span className="text-sm font-semibold text-muted" aria-hidden="true">
              <span className="group-open:hidden">펼치기 ▾</span>
              <span className="hidden group-open:inline">접기 ▴</span>
            </span>
          </summary>
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {trashed.map((card) => (
              <li key={card.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold text-ink">{card.title}</span>
                  <span className="text-sm text-muted">
                    {stageLabel(card.stage)} 단계
                    {card.deletedBy ? (
                      <>
                        {" · "}
                        <span className="break-anywhere">{labelForEmail(card.deletedBy, members)}</span>
                      </>
                    ) : null}
                    {card.deletedAt !== null ? ` · ${deletedDateLabel(card.deletedAt)} 삭제` : null}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(card)}
                  loading={restoringId === card.id}
                  disabled={restoringId !== null && restoringId !== card.id}
                  loadingLabel="되살리는 중"
                >
                  되살리기
                </Button>
              </li>
            ))}
          </ul>
        </details>
      </Panel>
    </section>
  );
}
