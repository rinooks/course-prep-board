"use client";

// 체크리스트 항목 추가. Enter(한글 조합 중 Enter는 무시)나 추가 버튼으로 넣는다.
// 실패하면 쓴 글은 그대로 두고, 같은 글로 다시 누르면 같은 id로 보내 항목이 두 번 생기지 않는다.
// 글을 바꿔 다시 보내면 새 id를 쓴다 (바뀐 글이 저장되지 않고 성공처럼 보이는 일을 막는다).

import { useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { describedBy, FieldError } from "@/components/ui/Field";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useImeSafeEnter } from "@/components/ui/useImeSafeEnter";
import { useRetryId } from "@/components/ui/useRetryId";
import { createChecklistItem } from "@/lib/data/checklist";
import { orderAtEnd } from "@/lib/domain/ordering";
import { LIMITS } from "@/lib/domain/validation";

interface ChecklistAddFormProps {
  courseId: string;
  cardId: string;
  /** 이 카드 항목들의 order (새 항목은 맨 끝) */
  orders: readonly number[];
}

export function ChecklistAddForm({ courseId, cardId, orders }: ChecklistAddFormProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const retryIds = useRetryId();

  const add = useAsyncAction((value: string, itemId: string) =>
    createChecklistItem(courseId, { cardId, text: value, order: orderAtEnd(orders) }, { id: itemId }),
  );

  async function submit() {
    if (add.pending) return;
    const result = await add.run(text, retryIds.idFor(text));
    if (result.ok) {
      setText("");
      retryIds.reset();
      inputRef.current?.focus();
    }
  }

  const handleKeyDown = useImeSafeEnter(() => {
    void submit();
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  const textError = add.fieldErrors.text ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        새 체크리스트 항목
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          ref={inputRef}
          value={text}
          maxLength={LIMITS.checklistText}
          placeholder="항목을 입력하고 Enter"
          invalid={Boolean(textError)}
          aria-describedby={describedBy(inputId, { error: textError })}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="submit" variant="outline" size="sm" loading={add.pending} loadingLabel="추가하는 중">
          추가
        </Button>
      </div>
      <FieldError id={inputId}>{textError}</FieldError>
      {add.error && !textError ? <Alert tone="error">{add.error}</Alert> : null}
    </form>
  );
}
