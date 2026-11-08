"use client";

// 준비 일정(리허설·회의) 추가·고치기 창: 종류, 일정 이름(필수), 날짜(필수), 시작 시간, 메모.
// 회차 창(SessionFormModal)과 같은 방식이다.
// 실패해도 입력한 내용은 그대로 남고, 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 일정이 두 번 생기지 않는다.
// 내용을 고쳐 다시 보내면 새 id를 쓴다 (고친 내용이 저장되지 않고 성공처럼 보이는 일을 막는다).

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Select, Textarea, type SelectOption } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { createEvent, updateEvent } from "@/lib/data/events";
import type { CourseEvent, EventInput } from "@/lib/data/types";
import { EVENT_KIND_LABELS, EVENT_KINDS, isEventKind, type EventKind } from "@/lib/domain/events";
import { LIMITS } from "@/lib/domain/validation";

interface EventFormModalProps {
  courseId: string;
  /** 고칠 일정. 없으면 새 일정을 만든다 */
  event: CourseEvent | null;
  onClose: () => void;
}

interface EventDraft {
  kind: EventKind;
  title: string;
  date: string;
  startTime: string;
  note: string;
}

/** 새 일정의 기본 종류 */
const DEFAULT_KIND: EventKind = "rehearsal";

const KIND_OPTIONS: readonly SelectOption[] = EVENT_KINDS.map((kind) => ({
  value: kind,
  label: EVENT_KIND_LABELS[kind],
}));

function draftFrom(event: CourseEvent | null): EventDraft {
  return {
    kind: event?.kind ?? DEFAULT_KIND,
    title: event?.title ?? "",
    date: event?.date ?? "",
    startTime: event?.startTime ?? "",
    note: event?.note ?? "",
  };
}

function toInput(draft: EventDraft): EventInput {
  return {
    kind: draft.kind,
    title: draft.title,
    date: draft.date,
    startTime: draft.startTime.length > 0 ? draft.startTime : null,
    note: draft.note,
  };
}

/** 처음 값과 달라진 칸만 (일정 고치기용) */
function changedFields(initial: EventDraft, current: EventDraft): Partial<EventInput> {
  const input = toInput(current);
  const patch: Partial<EventInput> = {};
  if (current.kind !== initial.kind) patch.kind = input.kind;
  if (current.title !== initial.title) patch.title = input.title;
  if (current.date !== initial.date) patch.date = input.date;
  if (current.startTime !== initial.startTime) patch.startTime = input.startTime;
  if (current.note !== initial.note) patch.note = input.note;
  return patch;
}

export function EventFormModal({ courseId, event, onClose }: EventFormModalProps) {
  const baseId = useId();
  const toast = useToast();
  // 창을 연 순간의 값. 고칠 때는 바뀐 칸만 보내 다른 사람이 그사이 고친 칸을 덮어쓰지 않는다
  const [initial] = useState<EventDraft>(() => draftFrom(event));
  const [draft, setDraft] = useState<EventDraft>(initial);
  const retryIds = useRetryId();
  const isEdit = event !== null;

  const save = useAsyncAction(async (current: EventDraft) => {
    if (event) {
      await updateEvent(courseId, event.id, changedFields(initial, current));
      return event.id;
    }
    const input = toInput(current);
    return createEvent(courseId, input, { id: retryIds.idFor(JSON.stringify(input)) });
  });

  function change(field: Exclude<keyof EventDraft, "kind">, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeKind(value: string) {
    // 목록에 없는 값은 들어올 수 없지만, 들어오면 무시해 잘못된 종류가 저장되지 않게 한다
    if (isEventKind(value)) setDraft((current) => ({ ...current, kind: value }));
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success(isEdit ? "일정을 고쳤습니다." : "일정을 추가했습니다.");
      onClose();
    }
  }

  const errors = save.fieldErrors;
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const ids = {
    form: `${baseId}-form`,
    kind: `${baseId}-kind`,
    title: `${baseId}-title`,
    date: `${baseId}-date`,
    startTime: `${baseId}-time`,
    note: `${baseId}-note`,
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!save.pending) onClose();
      }}
      closeOnBackdrop={false}
      title={isEdit ? "일정 고치기" : "일정 추가"}
      description="리허설·회의처럼 강의 말고 챙길 일정입니다. 팀 캘린더에도 보입니다."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            취소
          </Button>
          <Button type="submit" form={ids.form} loading={save.pending} loadingLabel="저장하는 중">
            {isEdit ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      <form
        id={ids.form}
        onSubmit={handleSubmit}
        onKeyDown={blockImeEnterSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,10rem)_1fr]">
          <Field id={ids.kind} label="종류" required error={errors.kind}>
            <Select
              id={ids.kind}
              required
              value={draft.kind}
              options={KIND_OPTIONS}
              invalid={Boolean(errors.kind)}
              aria-describedby={describedBy(ids.kind, { error: errors.kind })}
              onChange={(changeEvent) => changeKind(changeEvent.target.value)}
            />
          </Field>
          <Field id={ids.title} label="일정 이름" required error={errors.title}>
            <Input
              id={ids.title}
              required
              value={draft.title}
              maxLength={LIMITS.eventTitle}
              placeholder="예: 최종 리허설, 고객사 사전 회의"
              invalid={Boolean(errors.title)}
              aria-describedby={describedBy(ids.title, { error: errors.title })}
              onChange={(changeEvent) => change("title", changeEvent.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.date} label="날짜" required error={errors.date}>
            <Input
              id={ids.date}
              type="date"
              required
              value={draft.date}
              invalid={Boolean(errors.date)}
              aria-describedby={describedBy(ids.date, { error: errors.date })}
              onChange={(changeEvent) => change("date", changeEvent.target.value)}
            />
          </Field>
          <Field id={ids.startTime} label="시작 시간" hint="비워 두어도 됩니다" error={errors.startTime}>
            <Input
              id={ids.startTime}
              type="time"
              value={draft.startTime}
              invalid={Boolean(errors.startTime)}
              aria-describedby={describedBy(ids.startTime, { error: errors.startTime, hint: true })}
              onChange={(changeEvent) => change("startTime", changeEvent.target.value)}
            />
          </Field>
        </div>

        <Field id={ids.note} label="메모" error={errors.note}>
          <Textarea
            id={ids.note}
            rows={3}
            value={draft.note}
            maxLength={LIMITS.eventNote}
            placeholder="예: 장소, 참석자, 준비물"
            invalid={Boolean(errors.note)}
            aria-describedby={describedBy(ids.note, { error: errors.note })}
            onChange={(changeEvent) => change("note", changeEvent.target.value)}
          />
        </Field>

        {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      </form>
    </Modal>
  );
}
