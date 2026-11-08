"use client";

import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, describedBy } from "@/components/ui/Field";
import { Input, Select, type SelectOption } from "@/components/ui/Input";
import { isImeComposing } from "@/components/ui/ime";
import { Section } from "@/components/ui/Section";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useImeSafeEnter } from "@/components/ui/useImeSafeEnter";
import { inviteMember } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { AppError, errorCode } from "@/lib/domain/errors";
import { isRole, roleLabel, type Role } from "@/lib/domain/roles";
import { LIMITS, validateInviteEmail } from "@/lib/domain/validation";
import { InviteSuccessNotice } from "./InviteSuccessNotice";
import { alreadyMemberMessage, isAlreadyMember } from "./memberRules";

const EMAIL_ID = "invite-email";
const ROLE_ID = "invite-role";
const ROLE_HINT = "관리자는 팀 관리와 과정 삭제도 할 수 있습니다.";

const ROLE_OPTIONS: readonly SelectOption[] = [
  { value: "instructor", label: roleLabel("instructor") },
  { value: "admin", label: roleLabel("admin") },
];

interface InviteMemberFormProps {
  /** 지금 팀원 목록. 이미 팀원인 이메일을 서버에 묻기 전에 걸러낸다 (아직 못 받았으면 빈 배열) */
  members: readonly Member[];
  /** 빈 목록 안내의 "초대할 이메일 입력하기" 버튼이 이 칸으로 포커스를 옮긴다 */
  inputRef: RefObject<HTMLInputElement | null>;
}

/** 이미 팀원이라는 서버 응답을 이메일 칸 아래 빨간 안내로 보여주려고 칸별 오류로 바꾼다 */
async function inviteWithFieldErrors(email: string, role: Role): Promise<string> {
  try {
    await inviteMember(email, role);
  } catch (caught) {
    if (errorCode(caught) === "already-member") {
      const message = alreadyMemberMessage(email);
      throw new AppError("invalid-input", message, { email: message });
    }
    throw caught;
  }
  return email;
}

/** 강사 초대 칸: 이메일 + 역할 + 초대 버튼 */
export function InviteMemberForm({ members, inputRef }: InviteMemberFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("instructor");
  const [localError, setLocalError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const invite = useAsyncAction(inviteWithFieldErrors);

  async function submit() {
    if (invite.pending) return;
    setInvitedEmail(null);

    // 서버에 묻기 전에 화면에서 먼저 확인한다 (서버도 같은 검사를 다시 한다)
    const check = validateInviteEmail(email);
    if (!check.ok) {
      invite.reset();
      setLocalError(check.errors.email ?? "이메일을 다시 확인해 주세요.");
      inputRef.current?.focus();
      return;
    }
    if (isAlreadyMember(check.value, members)) {
      invite.reset();
      setLocalError(alreadyMemberMessage(check.value));
      inputRef.current?.focus();
      return;
    }

    setLocalError(null);
    const result = await invite.run(check.value, role);
    if (result.ok) {
      // 성공했을 때만 입력을 비운다. 실패하면 입력은 그대로 둔다.
      setEmail("");
      setRole("instructor");
      setInvitedEmail(result.value);
    }
    inputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  const submitOnEnter = useImeSafeEnter(() => {
    void submit();
  });

  function handleEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 한글 조합 중 Enter는 글자 확정용이다. 브라우저가 폼을 저절로 제출하지 않게 막는다.
    if (event.key === "Enter" && isImeComposing(event)) {
      event.preventDefault();
      return;
    }
    submitOnEnter(event);
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    // 다시 고치기 시작하면 지난 오류 안내는 지운다
    if (localError) setLocalError(null);
    if (invite.error) invite.reset();
  }

  function handleRoleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setRole(isRole(value) ? value : "instructor");
  }

  const emailError = localError ?? invite.fieldErrors.email ?? null;
  const roleError = invite.fieldErrors.role ?? null;
  // 칸 아래에 이미 보인 문구는 위에서 한 번 더 보여주지 않는다
  const generalError = emailError || roleError ? null : invite.error;

  return (
    <Section
      tile
      title="강사 초대"
      description="초대할 사람의 구글 계정 이메일을 넣으세요. 초대된 계정만 이 앱에 들어올 수 있습니다."
    >
      <form noValidate onSubmit={handleSubmit} aria-label="강사 초대" className="flex flex-col gap-4">
        {/* 넓은 화면에서는 좁은 오른쪽 타일에 들어가므로 칸을 위아래로 놓는다 */}
        <div className="grid gap-4 md:max-lg:grid-cols-[minmax(0,1fr)_12rem]">
          <Field id={EMAIL_ID} label="구글 계정 이메일" required error={emailError}>
            <Input
              id={EMAIL_ID}
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={LIMITS.email}
              placeholder="name@gmail.com"
              value={email}
              onChange={handleEmailChange}
              onKeyDown={handleEmailKeyDown}
              invalid={Boolean(emailError)}
              aria-required="true"
              aria-describedby={describedBy(EMAIL_ID, { error: emailError })}
            />
          </Field>
          <Field id={ROLE_ID} label="역할" hint={ROLE_HINT} error={roleError}>
            <Select
              id={ROLE_ID}
              value={role}
              onChange={handleRoleChange}
              options={ROLE_OPTIONS}
              invalid={Boolean(roleError)}
              aria-describedby={describedBy(ROLE_ID, { error: roleError, hint: ROLE_HINT })}
            />
          </Field>
        </div>

        {generalError ? (
          <Alert tone="error" title="초대하지 못했습니다">
            {generalError}
          </Alert>
        ) : null}
        {invitedEmail ? <InviteSuccessNotice email={invitedEmail} /> : null}

        <div className="flex md:justify-end">
          <Button type="submit" loading={invite.pending} loadingLabel="초대하는 중" className="w-full md:w-auto">
            초대하기
          </Button>
        </div>
      </form>
    </Section>
  );
}
