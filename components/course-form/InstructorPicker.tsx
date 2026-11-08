"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn, focusRing } from "@/components/ui/cn";
import { FieldError, fieldErrorId, fieldHintId } from "@/components/ui/Field";
import { InlineLoading } from "@/components/ui/Spinner";
import { memberLabel } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { toggleInstructor } from "./courseFormState";
import { FIELDSET_LEGEND_CLASS } from "./fieldsetLegend";

interface InstructorPickerProps {
  /** 첫 체크박스 id. 오류가 나면 이 칸으로 포커스를 옮긴다 */
  id: string;
  members: Member[] | null;
  membersError: string | null;
  onRetryMembers: () => void;
  selected: string[];
  onChange: (next: string[]) => void;
  error?: string | null;
}

/** 담당 강사 여러 명 고르기 (팀원 목록 체크박스) */
export function InstructorPicker({
  id,
  members,
  membersError,
  onRetryMembers,
  selected,
  onChange,
  error,
}: InstructorPickerProps) {
  const describedBy = [fieldHintId(id), error ? fieldErrorId(id) : null].filter(Boolean).join(" ");

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={describedBy}>
      <legend className={FIELDSET_LEGEND_CLASS}>담당 강사</legend>
      <p id={fieldHintId(id)} className="text-sm text-muted">
        여러 명을 고를 수 있습니다. 나중에 과정 보드에서 바꿀 수 있습니다.
        {selected.length > 0 ? ` 지금 ${selected.length}명 골랐습니다.` : null}
      </p>

      <PickerBody
        id={id}
        members={members}
        membersError={membersError}
        onRetryMembers={onRetryMembers}
        selected={selected}
        onChange={onChange}
        invalid={Boolean(error)}
      />

      <FieldError id={id}>{error}</FieldError>
    </fieldset>
  );
}

function PickerBody({
  id,
  members,
  membersError,
  onRetryMembers,
  selected,
  onChange,
  invalid,
}: Omit<InstructorPickerProps, "error"> & { invalid: boolean }) {
  if (membersError) {
    return (
      <Alert
        tone="error"
        title="팀원 목록을 불러오지 못했습니다"
        action={
          <Button variant="outline" size="sm" onClick={onRetryMembers}>
            다시 시도
          </Button>
        }
      >
        {membersError} 담당 강사는 과정을 만든 뒤 보드에서 지정해도 됩니다.
      </Alert>
    );
  }

  if (!members) {
    return <InlineLoading label="팀원 목록을 불러오는 중입니다…" />;
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted">팀원이 없습니다. 관리자 화면에서 강사를 먼저 초대해 주세요.</p>;
  }

  // 모양은 CheckboxRow(boxed)와 같다. 첫 체크박스에 id(오류 때 포커스 대상)와 aria-invalid를 달아야 해서
  // CheckboxRow를 쓰지 않고 같은 클래스로 직접 그린다 (CheckboxRow는 추가 속성을 label에만 넘긴다).
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {members.map((member, index) => {
        const checked = selected.includes(member.email);
        const hasName = member.displayName.trim().length > 0;
        return (
          <li key={member.email}>
            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-card border px-3 py-2 transition hover:bg-ink/5 motion-reduce:transition-none",
                checked ? "border-primary bg-primary/5" : invalid ? "border-danger bg-white" : "border-line bg-white",
              )}
            >
              <input
                id={index === 0 ? id : undefined}
                type="checkbox"
                className={cn("size-5 shrink-0 rounded-button accent-primary", focusRing)}
                checked={checked}
                aria-invalid={invalid || undefined}
                onChange={(event) => onChange(toggleInstructor(selected, member.email, event.target.checked))}
              />
              <span className="flex min-w-0 flex-col">
                <span className={cn("text-sm font-semibold text-ink", !hasName && "break-anywhere")}>
                  {memberLabel(member)}
                </span>
                {hasName ? <span className="break-anywhere text-sm text-muted">{member.email}</span> : null}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
