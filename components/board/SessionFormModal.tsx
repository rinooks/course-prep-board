"use client";

// 회차 추가·고치기 창: 날짜(필수), 시작 시간, 장소, 대상, 메모.
// 실패해도 입력한 내용은 그대로 남고, 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 회차가 두 번 생기지 않는다.
// 내용을 고쳐 다시 보내면 새 id를 쓴다 (고친 내용이 저장되지 않고 성공처럼 보이는 일을 막는다).

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { createSession, updateSession } from "@/lib/data/sessions";
import type { Session, SessionInput } from "@/lib/data/types";
import { LIMITS } from "@/lib/domain/validation";

interface SessionFormModalProps {
  courseId: string;
  /** 고칠 회차. 없으면 새 회차를 만든다 */
  session: Session | null;
  onClose: () => void;
}

interface SessionDraft {
  date: string;
  startTime: string;
  location: string;
  audience: string;
  note: string;
}

function draftFrom(session: Session | null): SessionDraft {
  return {
    date: session?.date ?? "",
    startTime: session?.startTime ?? "",
    location: session?.location ?? "",
    audience: session?.audience ?? "",
    note: session?.note ?? "",
  };
}

function toInput(draft: SessionDraft): SessionInput {
  return {
    date: draft.date,
    startTime: draft.startTime.length > 0 ? draft.startTime : null,
    location: draft.location,
    audience: draft.audience,
    note: draft.note,
  };
}

/** 처음 값과 달라진 칸만 (회차 고치기용) */
function changedFields(initial: SessionDraft, current: SessionDraft): Partial<SessionInput> {
  const input = toInput(current);
  const patch: Partial<SessionInput> = {};
  if (current.date !== initial.date) patch.date = input.date;
  if (current.startTime !== initial.startTime) patch.startTime = input.startTime;
  if (current.location !== initial.location) patch.location = input.location;
  if (current.audience !== initial.audience) patch.audience = input.audience;
  if (current.note !== initial.note) patch.note = input.note;
  return patch;
}

export function SessionFormModal({ courseId, session, onClose }: SessionFormModalProps) {
  const baseId = useId();
  const toast = useToast();
  // 창을 연 순간의 값. 고칠 때는 바뀐 칸만 보내 다른 사람이 그사이 고친 칸을 덮어쓰지 않는다
  const [initial] = useState<SessionDraft>(() => draftFrom(session));
  const [draft, setDraft] = useState<SessionDraft>(initial);
  const retryIds = useRetryId();
  const isEdit = session !== null;

  const save = useAsyncAction(async (current: SessionDraft) => {
    if (session) {
      await updateSession(courseId, session.id, changedFields(initial, current));
      return session.id;
    }
    const input = toInput(current);
    return createSession(courseId, input, { id: retryIds.idFor(JSON.stringify(input)) });
  });

  function change(field: keyof SessionDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success(isEdit ? "회차를 고쳤습니다." : "회차를 추가했습니다.");
      onClose();
    }
  }

  const errors = save.fieldErrors;
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const ids = {
    form: `${baseId}-form`,
    date: `${baseId}-date`,
    startTime: `${baseId}-time`,
    location: `${baseId}-location`,
    audience: `${baseId}-audience`,
    note: `${baseId}-note`,
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!save.pending) onClose();
      }}
      closeOnBackdrop={false}
      title={isEdit ? "회차 고치기" : "회차 추가"}
      description="과정을 실제로 진행하는 날짜·장소·대상입니다. 같은 과정을 여러 번 하면 회차를 여러 개 둡니다."
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
        className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.date} label="강의 날짜" required error={errors.date}>
            <Input
              id={ids.date}
              type="date"
              required
              value={draft.date}
              invalid={Boolean(errors.date)}
              aria-describedby={describedBy(ids.date, { error: errors.date })}
              onChange={(event) => change("date", event.target.value)}
            />
          </Field>
          <Field id={ids.startTime} label="시작 시간" hint="비워 두어도 됩니다" error={errors.startTime}>
            <Input
              id={ids.startTime}
              type="time"
              value={draft.startTime}
              invalid={Boolean(errors.startTime)}
              aria-describedby={describedBy(ids.startTime, { error: errors.startTime, hint: true })}
              onChange={(event) => change("startTime", event.target.value)}
            />
          </Field>
        </div>

        <Field id={ids.location} label="장소" error={errors.location}>
          <Input
            id={ids.location}
            value={draft.location}
            maxLength={LIMITS.sessionLocation}
            placeholder="예: A사 본사 3층 교육장, 온라인(줌)"
            invalid={Boolean(errors.location)}
            aria-describedby={describedBy(ids.location, { error: errors.location })}
            onChange={(event) => change("location", event.target.value)}
          />
        </Field>

        <Field id={ids.audience} label="대상" error={errors.audience}>
          <Input
            id={ids.audience}
            value={draft.audience}
            maxLength={LIMITS.sessionAudience}
            placeholder="예: 신입사원 30명"
            invalid={Boolean(errors.audience)}
            aria-describedby={describedBy(ids.audience, { error: errors.audience })}
            onChange={(event) => change("audience", event.target.value)}
          />
        </Field>

        <Field id={ids.note} label="메모" error={errors.note}>
          <Textarea
            id={ids.note}
            rows={3}
            value={draft.note}
            maxLength={LIMITS.sessionNote}
            invalid={Boolean(errors.note)}
            aria-describedby={describedBy(ids.note, { error: errors.note })}
            onChange={(event) => change("note", event.target.value)}
          />
        </Field>

        {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      </form>
    </Modal>
  );
}
