"use client";

// 카드 상세의 체크리스트: 진행률(3/5) + 항목 목록 + 항목 추가.
// 체크·고치기·옮기기·지우기는 누르는 즉시 저장된다 (위 "변경 내용 저장"과 상관없다).

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import type { ChecklistItem } from "@/lib/data/types";
import { ChecklistAddForm } from "./ChecklistAddForm";
import { ChecklistItemRow } from "./ChecklistItemRow";

interface ChecklistEditorProps {
  courseId: string;
  cardId: string;
  /** 이 카드의 항목 (order 순) */
  items: readonly ChecklistItem[];
  loaded: boolean;
  error: string | null;
  onRetry: () => void;
  headingId: string;
}

export function ChecklistEditor({ courseId, cardId, items, loaded, error, onRetry, headingId }: ChecklistEditorProps) {
  const done = items.filter((item) => item.done).length;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <SectionHeading
        as="h3"
        id={headingId}
        meta={
          items.length > 0 ? (
            <>
              <span aria-hidden="true">
                {done}/{items.length}
              </span>
              <span className="sr-only">
                {items.length}개 중 {done}개 끝남
              </span>
            </>
          ) : undefined
        }
      >
        체크리스트
      </SectionHeading>

      {error ? (
        <Alert
          tone="error"
          title="체크리스트를 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {!loaded && !error ? <InlineLoading label="체크리스트를 불러오는 중입니다…" /> : null}

      {loaded && items.length === 0 ? (
        <p className="text-sm text-muted">아직 항목이 없습니다. 아래에 할 일을 하나씩 적어 넣으세요.</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <ChecklistItemRow key={item.id} courseId={courseId} item={item} siblings={items} index={index} />
          ))}
        </ul>
      ) : null}

      <ChecklistAddForm courseId={courseId} cardId={cardId} orders={items.map((item) => item.order)} />
    </section>
  );
}
