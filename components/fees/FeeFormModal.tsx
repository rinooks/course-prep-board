"use client";

// 강사료 추가·고치기 창: 받는 강사, 항목 이름, 금액, 입금 예정일, 이미 입금됨 + 입금일, 메모.
// - 강사는 자기 강사료만 만든다 (받는 강사 칸은 글자로만 보인다). 관리자는 팀원 중에서 고른다.
// - 받는 강사는 만든 뒤 바꿀 수 없다 (보안 규칙). 고칠 때는 글자로만 보여 준다.
// - 실패해도 입력한 내용은 그대로 남고, 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 두 건이 생기지 않는다.

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Select, Textarea, type SelectOption } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CheckboxRow } from "@/components/ui/Row";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { createFee, updateFee } from "@/lib/data/fees";
import { labelForEmail } from "@/lib/data/members";
import type { Fee, Member } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { AppError } from "@/lib/domain/errors";
import { formatWon } from "@/lib/domain/fees";
import { LIMITS } from "@/lib/domain/validation";
import { defaultInstructor, feeTitle, instructorChoices } from "./feeDisplay";
import {
  changedFeeFields,
  feeDraftErrors,
  feeDraftFrom,
  newFeeDraft,
  previewAmount,
  tidyAmountInput,
  toFeeInput,
  type FeeDraft,
} from "./feeForm";

const AMOUNT_HINT = "세금을 뺀 실제 입금액으로 적으면 입금 확인이 쉽습니다.";

interface FeeFormModalProps {
  courseId: string;
  /** 고칠 강사료. 없으면 새로 만든다 */
  fee: Fee | null;
  /** 과정 담당 강사 (관리자의 받는 강사 선택지 맨 앞에 둔다) */
  courseInstructors: readonly string[];
  /** 새 강사료의 입금 예정일 처음 값 */
  defaultDueDate: DateString;
  /** 입금 예정일 칸 아래 설명 (처음 값을 어떻게 정했는지) */
  dueDateHint?: string;
  me: string;
  isAdmin: boolean;
  /** 팀원 목록. 아직 못 받았으면 null */
  members: readonly Member[] | null;
  today: DateString;
  onClose: () => void;
}

export function FeeFormModal({
  courseId,
  fee,
  courseInstructors,
  defaultDueDate,
  dueDateHint,
  me,
  isAdmin,
  members,
  today,
  onClose,
}: FeeFormModalProps) {
  const baseId = useId();
  const toast = useToast();
  const retryIds = useRetryId();
  const isEdit = fee !== null;
  const memberList = members ?? [];

  const choices = instructorChoices(
    courseInstructors,
    members ? members.map((member) => member.email) : null,
    me,
  );

  // 창을 연 순간의 값. 고칠 때는 바뀐 칸만 보낸다
  const [initial] = useState<FeeDraft>(() =>
    fee ? feeDraftFrom(fee) : newFeeDraft(defaultInstructor(choices, me, isAdmin), defaultDueDate),
  );
  const [draft, setDraft] = useState<FeeDraft>(initial);

  const save = useAsyncAction(async (current: FeeDraft) => {
    const localErrors = feeDraftErrors(current);
    const firstError = Object.values(localErrors)[0];
    if (firstError) throw new AppError("invalid-input", firstError, localErrors);

    if (fee) {
      await updateFee(fee.id, changedFeeFields(initial, current));
      return fee.id;
    }
    const input = toFeeInput(current, courseId);
    return createFee(input, { id: retryIds.idFor(JSON.stringify(input)) });
  });

  function change<K extends keyof FeeDraft>(field: K, value: FeeDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changePaid(checked: boolean) {
    // 처음 체크하면 입금일을 오늘로 채운다 (고를 일을 줄인다)
    setDraft((current) => ({
      ...current,
      paid: checked,
      paidDate: checked && current.paidDate.length === 0 ? today : current.paidDate,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success(isEdit ? "강사료를 고쳤습니다." : "강사료를 추가했습니다.");
      onClose();
    }
  }

  const errors = save.fieldErrors;
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const ids = {
    form: `${baseId}-form`,
    instructor: `${baseId}-instructor`,
    label: `${baseId}-label`,
    amount: `${baseId}-amount`,
    dueDate: `${baseId}-due`,
    paidDate: `${baseId}-paid`,
    memo: `${baseId}-memo`,
  };

  const instructorOptions: SelectOption[] = choices.map((choice) => ({
    value: choice.email,
    label: `${labelForEmail(choice.email, memberList)}${choice.isCourseInstructor ? " (담당 강사)" : ""}`,
  }));
  const pickInstructor = isAdmin && !isEdit;
  const fixedInstructor = isEdit ? fee.instructorEmail : me;
  const amountPreview = previewAmount(draft.amount);
  const amountHint = amountPreview !== null ? `${formatWon(amountPreview)} · ${AMOUNT_HINT}` : AMOUNT_HINT;

  return (
    <Modal
      open
      onClose={() => {
        if (!save.pending) onClose();
      }}
      closeOnBackdrop={false}
      title={isEdit ? `‘${feeTitle(fee)}’ 강사료 고치기` : "강사료 추가"}
      description="금액은 강사 본인과 관리자만 볼 수 있습니다."
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
        {pickInstructor ? (
          <Field id={ids.instructor} label="받는 강사" required error={errors.instructorEmail}>
            <Select
              id={ids.instructor}
              required
              value={draft.instructorEmail}
              options={instructorOptions}
              placeholder="강사를 골라 주세요"
              invalid={Boolean(errors.instructorEmail)}
              aria-describedby={describedBy(ids.instructor, { error: errors.instructorEmail })}
              onChange={(event) => change("instructorEmail", event.target.value)}
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-ink">받는 강사</p>
            <p className="text-base text-ink">{labelForEmail(fixedInstructor, memberList)}</p>
            <p className="text-sm text-muted">
              {isEdit
                ? "받는 강사는 바꿀 수 없습니다. 잘못 넣었으면 지우고 다시 추가해 주세요."
                : "강사는 자기 강사료만 추가할 수 있습니다."}
            </p>
            {errors.instructorEmail ? (
              <p role="alert" className="text-sm text-danger">
                {errors.instructorEmail}
              </p>
            ) : null}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.label} label="항목 이름" hint="비워 두면 '강사료'로 보입니다." error={errors.label}>
            <Input
              id={ids.label}
              value={draft.label}
              maxLength={LIMITS.feeLabel}
              placeholder="예: 1회차, 선금"
              invalid={Boolean(errors.label)}
              aria-describedby={describedBy(ids.label, { error: errors.label, hint: true })}
              onChange={(event) => change("label", event.target.value)}
            />
          </Field>
          <Field id={ids.amount} label="금액" required hint={amountHint} error={errors.amount}>
            <div className="flex items-center gap-2">
              <Input
                id={ids.amount}
                className="min-w-0"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={draft.amount}
                placeholder="예: 1,200,000"
                invalid={Boolean(errors.amount)}
                aria-describedby={describedBy(ids.amount, { error: errors.amount, hint: true })}
                onChange={(event) => change("amount", event.target.value)}
                onBlur={(event) => change("amount", tidyAmountInput(event.target.value))}
              />
              <span aria-hidden="true" className="shrink-0 text-base text-ink">
                원
              </span>
            </div>
          </Field>
        </div>

        <Field
          id={ids.dueDate}
          label="입금 예정일"
          required
          hint={isEdit ? undefined : dueDateHint}
          error={errors.dueDate}
        >
          <Input
            id={ids.dueDate}
            type="date"
            required
            value={draft.dueDate}
            invalid={Boolean(errors.dueDate)}
            aria-describedby={describedBy(ids.dueDate, {
              error: errors.dueDate,
              hint: isEdit ? undefined : dueDateHint,
            })}
            onChange={(event) => change("dueDate", event.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <CheckboxRow
            boxed
            checked={draft.paid}
            onChange={changePaid}
            label="이미 입금됨"
            description="입금을 확인했으면 체크하고 입금일을 골라 주세요."
          />
          {draft.paid ? (
            <Field id={ids.paidDate} label="입금일" required error={errors.paidDate}>
              <Input
                id={ids.paidDate}
                type="date"
                required
                value={draft.paidDate}
                invalid={Boolean(errors.paidDate)}
                aria-describedby={describedBy(ids.paidDate, { error: errors.paidDate })}
                onChange={(event) => change("paidDate", event.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <Field id={ids.memo} label="메모" error={errors.memo}>
          <Textarea
            id={ids.memo}
            rows={3}
            value={draft.memo}
            maxLength={LIMITS.feeMemo}
            placeholder="예: 3.3% 원천징수 뺀 금액, 고객사 담당자에게 세금계산서 요청함"
            invalid={Boolean(errors.memo)}
            aria-describedby={describedBy(ids.memo, { error: errors.memo })}
            onChange={(event) => change("memo", event.target.value)}
          />
        </Field>

        {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      </form>
    </Modal>
  );
}
