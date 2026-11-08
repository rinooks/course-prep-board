"use client";

// 카드 상세의 고치기 칸: 제목, 담당자, 마감일, 메모. "저장"을 눌러야 저장된다.
// 고친 내용(edits)은 부모(CardDetailModal)가 들고 있어서, 저장하지 않고 닫으려 하면 물어볼 수 있다.

import { useId, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Select, Textarea, type SelectOption } from "@/components/ui/Input";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { updateCard } from "@/lib/data/cards";
import { memberLabel } from "@/lib/data/members";
import type { Card, Member } from "@/lib/data/types";
import { LIMITS } from "@/lib/domain/validation";
import {
  displayedFieldValue,
  editsToPatch,
  hasEdits,
  withFieldEdit,
  withoutSaved,
  type CardEditableField,
  type CardEdits,
} from "./cardEdits";

interface CardFieldsFormProps {
  courseId: string;
  card: Card;
  members: readonly Member[];
  edits: CardEdits;
  onEditsChange: Dispatch<SetStateAction<CardEdits>>;
}

/** 담당자 선택지: 팀원 목록 + (팀에서 나간 사람이 지정돼 있으면) 그 이메일 */
function assigneeOptions(members: readonly Member[], current: string): SelectOption[] {
  const options: SelectOption[] = members.map((member) => ({
    value: member.email,
    label: member.displayName ? `${memberLabel(member)} (${member.email})` : member.email,
  }));
  if (current && !members.some((member) => member.email === current)) {
    options.push({ value: current, label: `${current} (팀원 목록에 없음)` });
  }
  return options;
}

export function CardFieldsForm({ courseId, card, members, edits, onEditsChange }: CardFieldsFormProps) {
  const baseId = useId();
  const ids = {
    title: `${baseId}-title`,
    assignee: `${baseId}-assignee`,
    dueDate: `${baseId}-due`,
    memo: `${baseId}-memo`,
  };

  const save = useAsyncAction((submitted: CardEdits) =>
    updateCard(courseId, card.id, editsToPatch(submitted)),
  );
  const dirty = hasEdits(edits);

  function valueOf(field: CardEditableField): string {
    return displayedFieldValue(card, edits, field);
  }

  function change(field: CardEditableField, value: string) {
    onEditsChange((current) => withFieldEdit(card, current, field, value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty) return;
    const submitted = edits;
    const result = await save.run(submitted);
    // 저장하는 동안 또 고친 칸은 남긴다
    if (result.ok) onEditsChange((current) => withoutSaved(current, submitted));
  }

  const errors = save.fieldErrors;
  const assignee = valueOf("assigneeEmail");
  const dueDate = valueOf("dueDate");
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;

  return (
    <form onSubmit={handleSubmit} onKeyDown={blockImeEnterSubmit} className="flex flex-col gap-4" noValidate>
      <Field id={ids.title} label="카드 제목" required error={errors.title}>
        <Input
          id={ids.title}
          value={valueOf("title")}
          maxLength={LIMITS.cardTitle}
          invalid={Boolean(errors.title)}
          aria-describedby={describedBy(ids.title, { error: errors.title })}
          onChange={(event) => change("title", event.target.value)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id={ids.assignee} label="담당자" error={errors.assigneeEmail}>
          <Select
            id={ids.assignee}
            value={assignee}
            placeholder="담당자 없음"
            options={assigneeOptions(members, assignee)}
            invalid={Boolean(errors.assigneeEmail)}
            aria-describedby={describedBy(ids.assignee, { error: errors.assigneeEmail })}
            onChange={(event) => change("assigneeEmail", event.target.value)}
          />
        </Field>

        <Field id={ids.dueDate} label="마감일" error={errors.dueDate}>
          <div className="flex gap-2">
            <Input
              id={ids.dueDate}
              type="date"
              value={dueDate}
              invalid={Boolean(errors.dueDate)}
              aria-describedby={describedBy(ids.dueDate, { error: errors.dueDate })}
              onChange={(event) => change("dueDate", event.target.value)}
            />
            {dueDate ? (
              <Button variant="ghost" size="sm" onClick={() => change("dueDate", "")}>
                지우기
                <span className="sr-only">(마감일)</span>
              </Button>
            ) : null}
          </div>
        </Field>
      </div>

      <Field id={ids.memo} label="메모" error={errors.memo} hint={`${LIMITS.cardMemo.toLocaleString("ko-KR")}자까지`}>
        <Textarea
          id={ids.memo}
          rows={5}
          value={valueOf("memo")}
          maxLength={LIMITS.cardMemo}
          invalid={Boolean(errors.memo)}
          aria-describedby={describedBy(ids.memo, { error: errors.memo, hint: true })}
          onChange={(event) => change("memo", event.target.value)}
        />
      </Field>

      {generalError ? <Alert tone="error">{generalError}</Alert> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty ? (
          <p className="mr-auto text-sm text-muted" role="status">
            저장하지 않은 변경이 있습니다.
          </p>
        ) : null}
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => onEditsChange({})} disabled={save.pending}>
            고친 내용 버리기
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={!dirty} loading={save.pending} loadingLabel="저장하는 중">
          변경 내용 저장
        </Button>
      </div>
    </form>
  );
}
