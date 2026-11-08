"use client";

// 최종본 링크 넣기·바꾸기·지우기 창. 부모가 열 때만 그린다 ({open ? <FinalLinkModal /> : null}).
// 앱에 파일을 올리지 않으므로, PowerPoint 등에서 다듬은 최종본은 구글 드라이브 같은 곳에 올리고 그 링크만 남긴다.
// 입력값은 화면에서 먼저 검사하고(validateOutputLink), 저장할 때 데이터 계층과 보안 규칙이 한 번 더 검사한다.

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, describedBy } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { setOutputFinalUrl } from "@/lib/data/drafts";
import type { Output } from "@/lib/data/types";
import { LIMITS, validateOutputLink } from "@/lib/domain/validation";
import { outputTitle } from "./outputLabels";

const HINT = "구글 드라이브 등에 올린 파일의 공유 링크를 붙여 넣으세요. 팀원이 열 수 있게 공유 설정도 확인해 주세요.";

interface FinalLinkModalProps {
  courseId: string;
  output: Output;
  onClose: () => void;
}

export function FinalLinkModal({ courseId, output, onClose }: FinalLinkModalProps) {
  const toast = useToast();
  const baseId = useId();
  const formId = `${baseId}-form`;
  const inputId = `${baseId}-url`;
  // 창을 연 순간의 저장 값으로 시작한다 (창은 열 때마다 새로 만들어진다)
  const [value, setValue] = useState(output.finalUrl);
  const [checkError, setCheckError] = useState<string | null>(null);
  const save = useAsyncAction((url: string) => setOutputFinalUrl(courseId, output.id, url));
  const hasSavedLink = output.finalUrl.length > 0;
  const fieldError = checkError ?? save.fieldErrors.finalUrl ?? null;
  const generalError = save.error && !save.fieldErrors.finalUrl ? save.error : null;

  function close() {
    if (!save.pending) onClose();
  }

  async function saveLink(url: string) {
    const result = await save.run(url);
    if (!result.ok) return;
    toast.success(url === "" ? `${outputTitle(output)}의 최종본 링크를 지웠습니다.` : `${outputTitle(output)}의 최종본 링크를 저장했습니다.`);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = validateOutputLink(value);
    if (!check.ok) {
      setCheckError(check.errors.finalUrl ?? "링크 주소를 확인해 주세요.");
      return;
    }
    if (check.value === "" && !hasSavedLink) {
      setCheckError("링크를 붙여 넣어 주세요. 넣지 않으려면 '취소'를 눌러 주세요.");
      return;
    }
    await saveLink(check.value);
  }

  return (
    <Modal
      open
      onClose={close}
      // 입력 중에 바깥을 눌러 글이 사라지지 않게 한다
      closeOnBackdrop={false}
      size="sm"
      title="최종본 링크"
      description={`${outputTitle(output)}을 PowerPoint 등에서 다듬은 최종본 파일의 링크를 남깁니다.`}
      footer={
        <>
          {hasSavedLink ? (
            // 휴대폰에서는 맨 아래, 넓은 화면에서는 왼쪽 끝에 둔다 (저장과 떨어뜨려 잘못 누르지 않게)
            <Button variant="dangerGhost" onClick={() => saveLink("")} disabled={save.pending} className="md:mr-auto">
              링크 지우기
            </Button>
          ) : null}
          <Button variant="outline" onClick={close} disabled={save.pending}>
            취소
          </Button>
          <Button type="submit" form={formId} loading={save.pending} loadingLabel="저장하는 중">
            저장
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} onKeyDown={blockImeEnterSubmit} className="flex flex-col gap-4">
        <Field id={inputId} label="링크 주소" hint={HINT} error={fieldError}>
          <Input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={LIMITS.outputUrl}
            placeholder="https://drive.google.com/…"
            value={value}
            invalid={Boolean(fieldError)}
            aria-describedby={describedBy(inputId, { error: fieldError, hint: HINT })}
            className="break-anywhere"
            onChange={(event) => {
              setValue(event.target.value);
              if (checkError) setCheckError(null);
              if (save.error) save.reset();
            }}
          />
        </Field>
        {generalError ? (
          <Alert tone="error" title="링크를 저장하지 못했습니다">
            {generalError}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}
