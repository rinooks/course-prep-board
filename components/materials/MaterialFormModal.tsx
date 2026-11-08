"use client";

// 재료 추가·고치기 창. 종류마다 칸이 다르다.
// - 붙여 넣은 글: 제목, 내용(필수)
// - 받아쓰기: 제목, 받아쓰기 버튼 + 내용(필수, 받아쓴 글을 고칠 수 있다)
// - 링크: 제목, 주소(필수), 설명
// 공통: 관련 단계, 메모, "AI에 보내지 않음".
// 실패해도 입력한 내용은 그대로 남는다. 추가는 같은 내용으로 다시 눌러도 같은 id로 보내 두 번 생기지 않는다.

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { copyText } from "@/components/ui/copyText";
import { describedBy, Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CheckboxRow } from "@/components/ui/Row";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { createMaterial, trashMaterial, updateMaterial } from "@/lib/data/materials";
import type { Material, MaterialInput, MaterialUpdateInput } from "@/lib/data/types";
import { hasTextBody, MATERIAL_KIND_LABELS, type MaterialKind } from "@/lib/domain/materials";
import { STAGES, isStageId, type StageId } from "@/lib/domain/stages";
import { appendTranscript } from "@/lib/domain/transcript";
import { LIMITS } from "@/lib/domain/validation";
import { DictationControl } from "./DictationControl";

interface MaterialFormModalProps {
  courseId: string;
  /** 새로 만들 때의 종류 (material이 있으면 무시) */
  kind: MaterialKind;
  /** 고칠 재료. 없으면 새로 만든다 */
  material: Material | null;
  onClose: () => void;
}

interface MaterialDraft {
  title: string;
  body: string;
  url: string;
  stage: string;
  memo: string;
  excludeFromAi: boolean;
}

function draftFrom(material: Material | null): MaterialDraft {
  return {
    title: material?.title ?? "",
    body: material?.body ?? "",
    url: material?.url ?? "",
    stage: material?.stage ?? "",
    memo: material?.memo ?? "",
    excludeFromAi: material?.excludeFromAi ?? false,
  };
}

function stageOf(value: string): StageId | null {
  return isStageId(value) ? value : null;
}

function toInput(kind: MaterialKind, draft: MaterialDraft): MaterialInput {
  return {
    kind,
    title: draft.title,
    body: draft.body,
    url: kind === "link" ? draft.url : "",
    stage: stageOf(draft.stage),
    memo: draft.memo,
    excludeFromAi: draft.excludeFromAi,
  };
}

/** 처음 값과 달라진 칸만 (고치기용. 그사이 다른 사람이 고친 칸을 덮어쓰지 않게) */
function changedFields(initial: MaterialDraft, current: MaterialDraft): MaterialUpdateInput {
  const patch: MaterialUpdateInput = {};
  if (current.title !== initial.title) patch.title = current.title;
  if (current.body !== initial.body) patch.body = current.body;
  if (current.url !== initial.url) patch.url = current.url;
  if (current.stage !== initial.stage) patch.stage = stageOf(current.stage);
  if (current.memo !== initial.memo) patch.memo = current.memo;
  if (current.excludeFromAi !== initial.excludeFromAi) patch.excludeFromAi = current.excludeFromAi;
  return patch;
}

const DESCRIPTIONS: Record<MaterialKind, string> = {
  text: "줌 회의 텍스트, 외부 AI에게 받은 초안, 메모처럼 글로 된 재료를 붙여 넣습니다.",
  dictation: "말하는 대로 글자로 바꿔 재료로 남깁니다. 받아쓴 글은 저장 전에 고칠 수 있습니다.",
  link: "음성·문서 파일은 구글 드라이브 같은 곳에 올리고 공유 링크를 남겨 주세요.",
};

export function MaterialFormModal({ courseId, kind: newKind, material, onClose }: MaterialFormModalProps) {
  const baseId = useId();
  const toast = useToast();
  const retryIds = useRetryId();
  const kind = material?.kind ?? newKind;
  const isEdit = material !== null;
  const [initial] = useState<MaterialDraft>(() => draftFrom(material));
  const [draft, setDraft] = useState<MaterialDraft>(initial);

  const save = useAsyncAction(async (current: MaterialDraft) => {
    if (material) {
      await updateMaterial(courseId, material.id, material.kind, changedFields(initial, current));
      return material.id;
    }
    const input = toInput(kind, current);
    return createMaterial(courseId, input, { id: retryIds.idFor(JSON.stringify(input)) });
  });
  const trash = useAsyncAction(() => trashMaterial(courseId, material?.id ?? ""));
  const busy = save.pending || trash.pending;

  function change<K extends keyof MaterialDraft>(field: K, value: MaterialDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success(isEdit ? "재료를 고쳤습니다." : "재료함에 넣었습니다.");
      onClose();
    }
  }

  async function handleTrash() {
    const result = await trash.run();
    if (result.ok) {
      toast.success("재료를 휴지통으로 옮겼습니다. 재료함 아래 휴지통에서 되살릴 수 있습니다.");
      onClose();
    }
  }

  async function handleCopy() {
    const ok = await copyText(draft.body);
    if (ok) toast.success("내용을 복사했습니다.");
    else toast.error("복사하지 못했습니다. 내용 칸을 눌러 전체 선택(Ctrl+A)한 뒤 복사해 주세요.");
  }

  const errors = save.fieldErrors;
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const ids = {
    form: `${baseId}-form`,
    title: `${baseId}-title`,
    url: `${baseId}-url`,
    body: `${baseId}-body`,
    stage: `${baseId}-stage`,
    memo: `${baseId}-memo`,
  };
  const bodyLabel = hasTextBody(kind) ? "내용" : "설명";
  const bodyHint = `${draft.body.length.toLocaleString("ko-KR")} / ${LIMITS.materialBody.toLocaleString("ko-KR")}자`;

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      closeOnBackdrop={false}
      size="lg"
      title={isEdit ? `${MATERIAL_KIND_LABELS[kind]} 재료 고치기` : `${MATERIAL_KIND_LABELS[kind]} 재료 넣기`}
      description={DESCRIPTIONS[kind]}
      footer={
        <>
          {isEdit ? (
            <Button
              variant="dangerGhost"
              className="mr-auto"
              onClick={handleTrash}
              loading={trash.pending}
              loadingLabel="옮기는 중"
              disabled={save.pending}
            >
              휴지통으로
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button type="submit" form={ids.form} loading={save.pending} loadingLabel="저장하는 중" disabled={trash.pending}>
            {isEdit ? "저장" : "재료함에 넣기"}
          </Button>
        </>
      }
    >
      <form id={ids.form} onSubmit={handleSubmit} onKeyDown={blockImeEnterSubmit} className="flex flex-col gap-4" noValidate>
        <Field id={ids.title} label="제목" required error={errors.title}>
          <Input
            id={ids.title}
            value={draft.title}
            maxLength={LIMITS.materialTitle}
            placeholder={kind === "link" ? "예: A사 기존 교안 (PPT)" : "예: 10/5 고객사 킥오프 회의"}
            invalid={Boolean(errors.title)}
            aria-describedby={describedBy(ids.title, { error: errors.title })}
            onChange={(event) => change("title", event.target.value)}
          />
        </Field>

        {kind === "link" ? (
          <Field id={ids.url} label="링크 주소" required error={errors.url}>
            <Input
              id={ids.url}
              type="url"
              inputMode="url"
              value={draft.url}
              maxLength={LIMITS.materialUrl}
              placeholder="https://drive.google.com/…"
              className="break-anywhere"
              invalid={Boolean(errors.url)}
              aria-describedby={describedBy(ids.url, { error: errors.url })}
              onChange={(event) => change("url", event.target.value)}
            />
          </Field>
        ) : null}

        {kind === "dictation" ? (
          <DictationControl
            disabled={busy}
            onText={(text) => setDraft((current) => ({ ...current, body: appendTranscript(current.body, text) }))}
          />
        ) : null}

        <Field id={ids.body} label={bodyLabel} required={hasTextBody(kind)} hint={bodyHint} error={errors.body}>
          <Textarea
            id={ids.body}
            rows={kind === "link" ? 3 : 12}
            value={draft.body}
            maxLength={LIMITS.materialBody}
            placeholder={kind === "text" ? "회의 내용이나 AI 초안을 여기에 붙여 넣으세요." : undefined}
            invalid={Boolean(errors.body)}
            aria-describedby={describedBy(ids.body, { error: errors.body, hint: bodyHint })}
            onChange={(event) => change("body", event.target.value)}
          />
        </Field>
        {isEdit && hasTextBody(kind) && draft.body.length > 0 ? (
          <Button variant="ghost" size="sm" className="self-start" onClick={handleCopy}>
            내용 복사
          </Button>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field id={ids.stage} label="관련 단계" hint="비워 두어도 됩니다">
            <Select
              id={ids.stage}
              value={draft.stage}
              aria-describedby={describedBy(ids.stage, { hint: true })}
              onChange={(event) => change("stage", event.target.value)}
            >
              <option value="">단계 없음</option>
              {STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.order}단계 · {stage.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={ids.memo} label="메모" error={errors.memo}>
            <Input
              id={ids.memo}
              value={draft.memo}
              maxLength={LIMITS.materialMemo}
              placeholder="예: 3장 사례 부분이 중요"
              invalid={Boolean(errors.memo)}
              aria-describedby={describedBy(ids.memo, { error: errors.memo })}
              onChange={(event) => change("memo", event.target.value)}
            />
          </Field>
        </div>

        <CheckboxRow
          boxed
          checked={draft.excludeFromAi}
          onChange={(checked) => change("excludeFromAi", checked)}
          label="AI에 보내지 않음"
          description="고객사 기밀처럼 외부 AI로 나가면 안 되는 재료입니다. 초안 요청문을 만들 때 자동으로 뺍니다."
        />

        {generalError ? <Alert tone="error" title="저장하지 못했습니다">{generalError}</Alert> : null}
        {trash.error ? <Alert tone="error" title="휴지통으로 옮기지 못했습니다">{trash.error}</Alert> : null}
      </form>
    </Modal>
  );
}
