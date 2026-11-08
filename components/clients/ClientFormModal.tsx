"use client";

// 고객사 추가·고치기 창: 이름(필수), 메모.
// - 같은 이름(띄어쓰기·"(주)" 차이 무시)이 이미 있으면 이름 칸에 안내가 뜬다 (createClient·updateClient가 막는다).
// - 실패해도 입력한 내용은 그대로 남는다. 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 두 번 생기지 않는다.
// - 이름을 바꾸면 예전 이름으로 적힌 과정과 연결이 끊긴다 (과정은 이름으로 고객사를 가리킨다). 그 경우 미리 알려 준다.

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { createClient, updateClient } from "@/lib/data/clients";
import type { Client, ClientInput } from "@/lib/data/types";
import { clientNameKey } from "@/lib/domain/clients";
import { LIMITS } from "@/lib/domain/validation";

interface ClientFormModalProps {
  /** 고칠 고객사. 없으면 새로 만든다 */
  client: Client | null;
  /** 새로 만들 때 이름 칸에 미리 넣을 값 (과정 보드의 "주소록에 추가"에서 온 경우) */
  initialName?: string;
  /** 지금 주소록의 고객사들 (같은 이름 검사용) */
  clients: readonly Client[];
  /** 이 고객사 이름으로 적힌 과정 수 (이름을 바꿀 때 안내용) */
  linkedCourseCount: number;
  onClose: () => void;
  /** 저장에 성공하면 부른다. 창 닫기와 알림은 부른 쪽이 맡는다 */
  onSaved: (clientId: string) => void;
}

interface ClientDraft {
  name: string;
  memo: string;
}

/** 처음 값과 달라진 칸만 (고치기용. 그사이 다른 사람이 고친 칸을 덮어쓰지 않게) */
function changedFields(initial: ClientDraft, current: ClientDraft): Partial<ClientInput> {
  const patch: Partial<ClientInput> = {};
  if (current.name !== initial.name) patch.name = current.name;
  if (current.memo !== initial.memo) patch.memo = current.memo;
  return patch;
}

export function ClientFormModal({
  client,
  initialName = "",
  clients,
  linkedCourseCount,
  onClose,
  onSaved,
}: ClientFormModalProps) {
  const baseId = useId();
  const retryIds = useRetryId();
  const isEdit = client !== null;
  const [initial] = useState<ClientDraft>(() => ({
    name: client?.name ?? initialName,
    memo: client?.memo ?? "",
  }));
  const [draft, setDraft] = useState<ClientDraft>(initial);

  const save = useAsyncAction(async (current: ClientDraft) => {
    if (client) {
      await updateClient(client.id, changedFields(initial, current), clients);
      return client.id;
    }
    const input: ClientInput = { name: current.name, memo: current.memo };
    const id = retryIds.idFor(JSON.stringify(input));
    // 앞서 보낸 같은 id의 고객사(응답이 늦어 다시 누른 경우)는 "같은 이름"으로 치지 않는다
    return createClient(
      input,
      clients.filter((existing) => existing.id !== id),
      { id },
    );
  });

  function change(field: keyof ClientDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      retryIds.reset();
      onSaved(result.value);
    }
  }

  function close() {
    if (!save.pending) onClose();
  }

  const errors = save.fieldErrors;
  const generalError = save.error && !errors.name && !errors.memo ? save.error : null;
  const renaming =
    isEdit && linkedCourseCount > 0 && clientNameKey(draft.name) !== clientNameKey(initial.name);
  const ids = {
    form: `${baseId}-form`,
    name: `${baseId}-name`,
    memo: `${baseId}-memo`,
  };
  const nameHint = "과정의 고객사 칸에 적은 이름과 같게 적으면 그 과정 보드에 담당자 연락처가 보입니다.";

  return (
    <Modal
      open
      onClose={close}
      closeOnBackdrop={false}
      title={isEdit ? "고객사 고치기" : "고객사 추가"}
      description="팀원 모두가 보고 고칠 수 있습니다."
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
        <Field id={ids.name} label="고객사 이름" required hint={nameHint} error={errors.name}>
          <Input
            id={ids.name}
            required
            value={draft.name}
            maxLength={LIMITS.clientName}
            placeholder="예: A사"
            autoComplete="off"
            invalid={Boolean(errors.name)}
            aria-describedby={describedBy(ids.name, { error: errors.name, hint: nameHint })}
            onChange={(event) => change("name", event.target.value)}
          />
        </Field>

        {renaming ? (
          <Alert tone="warning" title="이름을 바꾸면 과정과 연결이 끊깁니다">
            &lsquo;{initial.name}&rsquo;(으)로 적힌 과정 {linkedCourseCount}개에 담당자 연락처가 더는 보이지 않습니다. 그
            과정들의 &lsquo;과정 정보 수정&rsquo;에서 고객사 이름도 같이 바꿔 주세요.
          </Alert>
        ) : null}

        <Field id={ids.memo} label="메모" error={errors.memo}>
          <Textarea
            id={ids.memo}
            rows={3}
            value={draft.memo}
            maxLength={LIMITS.clientMemo}
            placeholder="예: 본사 주소, 세금계산서 담당 부서, 계약 시 참고할 점"
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
