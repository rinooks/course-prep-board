"use client";

// 담당자 추가·고치기 창: 이름(필수), 부서·직책, 전화번호, 이메일, 메모.
// 실패해도 입력한 내용은 그대로 남고, 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 두 번 생기지 않는다.
// 고칠 때는 바뀐 칸만 보내 그사이 다른 사람이 고친 칸을 덮어쓰지 않는다. 어느 고객사의 담당자인지는 바꿀 수 없다.

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { createContact, updateContact } from "@/lib/data/clients";
import type { Client, ClientContact, ContactInput, ContactUpdateInput } from "@/lib/data/types";
import { LIMITS } from "@/lib/domain/validation";

interface ContactFormModalProps {
  client: Client;
  /** 고칠 담당자. 없으면 새로 만든다 */
  contact: ClientContact | null;
  onClose: () => void;
}

interface ContactDraft {
  name: string;
  role: string;
  phone: string;
  email: string;
  memo: string;
}

const DRAFT_FIELDS = ["name", "role", "phone", "email", "memo"] as const;

function draftFrom(contact: ClientContact | null): ContactDraft {
  return {
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    memo: contact?.memo ?? "",
  };
}

/** 처음 값과 달라진 칸만 (고치기용) */
function changedFields(initial: ContactDraft, current: ContactDraft): ContactUpdateInput {
  const patch: ContactUpdateInput = {};
  for (const field of DRAFT_FIELDS) {
    if (current[field] !== initial[field]) patch[field] = current[field];
  }
  return patch;
}

export function ContactFormModal({ client, contact, onClose }: ContactFormModalProps) {
  const baseId = useId();
  const toast = useToast();
  const retryIds = useRetryId();
  const isEdit = contact !== null;
  const [initial] = useState<ContactDraft>(() => draftFrom(contact));
  const [draft, setDraft] = useState<ContactDraft>(initial);

  const save = useAsyncAction(async (current: ContactDraft) => {
    if (contact) {
      await updateContact(contact.id, changedFields(initial, current));
      return contact.id;
    }
    const input: ContactInput = { clientId: client.id, ...current };
    return createContact(input, { id: retryIds.idFor(JSON.stringify(input)) });
  });

  function change(field: keyof ContactDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success(isEdit ? "담당자 연락처를 고쳤습니다." : `${client.name}에 담당자를 추가했습니다.`);
      onClose();
    }
  }

  function close() {
    if (!save.pending) onClose();
  }

  const errors = save.fieldErrors;
  const hasFieldError = DRAFT_FIELDS.some((field) => Boolean(errors[field]));
  const generalError = save.error && !hasFieldError ? save.error : null;
  const ids = {
    form: `${baseId}-form`,
    name: `${baseId}-name`,
    role: `${baseId}-role`,
    phone: `${baseId}-phone`,
    email: `${baseId}-email`,
    memo: `${baseId}-memo`,
  };
  const phoneHint = "숫자와 - 만 적어 주세요. 내선 번호는 메모에 적습니다.";

  return (
    <Modal
      open
      onClose={close}
      closeOnBackdrop={false}
      title={isEdit ? "담당자 고치기" : "담당자 추가"}
      description={`${client.name}의 담당자입니다. 연락처는 팀원 모두에게 보입니다.`}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={save.pending}>
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.name} label="이름" required error={errors.name}>
            <Input
              id={ids.name}
              required
              value={draft.name}
              maxLength={LIMITS.contactName}
              placeholder="예: 김하나"
              autoComplete="off"
              invalid={Boolean(errors.name)}
              aria-describedby={describedBy(ids.name, { error: errors.name })}
              onChange={(event) => change("name", event.target.value)}
            />
          </Field>
          <Field id={ids.role} label="부서·직책" error={errors.role}>
            <Input
              id={ids.role}
              value={draft.role}
              maxLength={LIMITS.contactRole}
              placeholder="예: 인재개발팀 과장"
              autoComplete="off"
              invalid={Boolean(errors.role)}
              aria-describedby={describedBy(ids.role, { error: errors.role })}
              onChange={(event) => change("role", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.phone} label="전화번호" hint={phoneHint} error={errors.phone}>
            <Input
              id={ids.phone}
              type="tel"
              inputMode="tel"
              value={draft.phone}
              maxLength={LIMITS.contactPhone}
              placeholder="예: 010-1234-5678"
              autoComplete="off"
              invalid={Boolean(errors.phone)}
              aria-describedby={describedBy(ids.phone, { error: errors.phone, hint: phoneHint })}
              onChange={(event) => change("phone", event.target.value)}
            />
          </Field>
          <Field id={ids.email} label="이메일" error={errors.email}>
            <Input
              id={ids.email}
              type="email"
              inputMode="email"
              value={draft.email}
              maxLength={LIMITS.email}
              placeholder="예: name@company.com"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              invalid={Boolean(errors.email)}
              aria-describedby={describedBy(ids.email, { error: errors.email })}
              onChange={(event) => change("email", event.target.value)}
            />
          </Field>
        </div>

        <Field id={ids.memo} label="메모" error={errors.memo}>
          <Textarea
            id={ids.memo}
            rows={3}
            value={draft.memo}
            maxLength={LIMITS.contactMemo}
            placeholder="예: 내선 123, 오전에는 메일이 편하다고 함"
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
