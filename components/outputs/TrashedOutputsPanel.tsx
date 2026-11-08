"use client";

// 결과물 탭 맨 아래 "휴지통" 목록. 접어 두었다가 펼쳐서 되살린다.
// 휴지통에 넣은 결과물이 없으면 아무것도 보이지 않는다. 영구 삭제는 없다 (보안 규칙에서 막는다).

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import { setOutputTrashed } from "@/lib/data/drafts";
import type { Member, Output } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";
import { authorLabel, confirmedDateLabel, outputTitle } from "./outputLabels";

interface TrashedOutputsPanelProps {
  courseId: string;
  /** 휴지통에 있는 결과물 */
  outputs: readonly Output[];
  members: readonly Member[];
}

export function TrashedOutputsPanel({ courseId, outputs, members }: TrashedOutputsPanelProps) {
  const toast = useToast();
  const titleId = useId();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (outputs.length === 0) return null;

  async function handleRestore(output: Output) {
    setRestoringId(output.id);
    try {
      await setOutputTrashed(courseId, output.id, false);
      toast.success(`${outputTitle(output)}을 되살렸습니다.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    // 접힌 줄의 제목("휴지통 N개")을 구역 이름으로 쓴다
    <section aria-labelledby={titleId}>
      <Card padding="none">
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
              휴지통 <span className="ml-1 text-sm font-semibold text-muted tabular-nums">{outputs.length}개</span>
            </span>
            <span className="text-sm font-semibold text-muted" aria-hidden="true">
              <span className="group-open:hidden">펼치기 ▾</span>
              <span className="hidden group-open:inline">접기 ▴</span>
            </span>
          </summary>
          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {outputs.map((output) => (
              <li
                key={output.id}
                className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-base font-semibold text-ink">{outputTitle(output)}</span>
                  <span className="text-sm text-muted">
                    {output.deletedBy ? (
                      <>
                        <span className="break-anywhere">{authorLabel(output.deletedBy, members)}</span>
                        {" · "}
                      </>
                    ) : null}
                    {confirmedDateLabel(output.deletedAt)} 휴지통으로
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(output)}
                  loading={restoringId === output.id}
                  disabled={restoringId !== null && restoringId !== output.id}
                  loadingLabel="되살리는 중"
                >
                  되살리기
                </Button>
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </section>
  );
}
