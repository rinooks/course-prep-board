"use client";

// 새 초안 만들기 4단계: ① 재료 고르기 ② 추가 요청 ③ 요청문 복사(→ 웹 AI에 붙여 넣기) ④ AI 답 붙여 넣고 저장.
// 앱은 AI를 직접 부르지 않는다. "AI에 보내지 않음" 재료는 고를 수 없고 요청문에도 들어가지 않는다.

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { copyText } from "@/components/ui/copyText";
import { EmptyState } from "@/components/ui/EmptyState";
import { describedBy, Field } from "@/components/ui/Field";
import { CopyIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/Input";
import { CheckboxRow } from "@/components/ui/Row";
import { SectionHeading } from "@/components/ui/Section";
import { useToast } from "@/components/ui/Toast";
import type { Course, Material, Session } from "@/lib/data/types";
import { buildDraftPrompt, DRAFT_KIND_LABELS, type DraftKind, type PromptMaterial } from "@/lib/domain/drafts";
import { MATERIAL_KIND_LABELS } from "@/lib/domain/materials";
import { stageLabel } from "@/lib/domain/stages";
import { LIMITS } from "@/lib/domain/validation";

const AI_SITES = [
  { label: "Claude 열기", href: "https://claude.ai/new" },
  { label: "ChatGPT 열기", href: "https://chatgpt.com/" },
] as const;

function toPromptMaterial(material: Material): PromptMaterial {
  return {
    id: material.id,
    kind: material.kind,
    title: material.title,
    body: material.body,
    url: material.url,
    memo: material.memo,
    stage: material.stage,
    excludeFromAi: material.excludeFromAi,
  };
}

interface DraftComposerProps {
  course: Course;
  kind: DraftKind;
  /** 휴지통에 없는 재료 (최근 순) */
  materials: readonly Material[];
  sessions: readonly Session[];
  /** 고른 재료 id (종류를 바꿔도 유지된다) */
  selectedIds: ReadonlySet<string>;
  onSelectedChange: (ids: Set<string>) => void;
  request: string;
  onRequestChange: (value: string) => void;
  pasted: string;
  onPastedChange: (value: string) => void;
  /** 저장. 요청문에 실제로 들어간 재료 id를 함께 넘긴다. 성공하면 true */
  onSave: (content: string, materialIds: string[]) => Promise<boolean>;
  saving: boolean;
  saveError: string | null;
  contentError?: string;
}

export function DraftComposer({
  course,
  kind,
  materials,
  sessions,
  selectedIds,
  onSelectedChange,
  request,
  onRequestChange,
  pasted,
  onPastedChange,
  onSave,
  saving,
  saveError,
  contentError,
}: DraftComposerProps) {
  const baseId = useId();
  const toast = useToast();
  const [showPrompt, setShowPrompt] = useState(false);
  const ids = { request: `${baseId}-request`, pasted: `${baseId}-pasted`, prompt: `${baseId}-prompt` };
  const label = DRAFT_KIND_LABELS[kind];

  const chosen = useMemo(
    () => materials.filter((material) => selectedIds.has(material.id) && !material.excludeFromAi),
    [materials, selectedIds],
  );
  const built = useMemo(
    () =>
      buildDraftPrompt({
        kind,
        course: { title: course.title, client: course.client, description: course.description },
        sessions,
        materials: chosen.map(toPromptMaterial),
        request,
      }),
    [kind, course.title, course.client, course.description, sessions, chosen, request],
  );
  const sendable = materials.filter((material) => !material.excludeFromAi);

  function toggle(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  }

  async function handleCopy() {
    const ok = await copyText(built.text);
    if (ok) toast.success("요청문을 복사했습니다. AI 화면에 붙여 넣어 주세요.");
    else toast.error("복사하지 못했습니다. '요청문 보기'를 열어 전체 선택(Ctrl+A)한 뒤 복사해 주세요.");
  }

  async function handleSave() {
    const ok = await onSave(pasted, built.includedIds);
    if (ok) toast.success(`${label} 초안을 새 판으로 저장했습니다.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <SectionHeading
          as="h3"
          meta={`${chosen.length}개 고름`}
          description="초안에 쓸 재료를 고릅니다. 'AI 제외' 재료는 고를 수 없습니다."
          action={
            sendable.length > 0 ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => onSelectedChange(new Set(sendable.map((m) => m.id)))}>
                  모두 고르기
                </Button>
                <Button variant="ghost" size="sm" disabled={selectedIds.size === 0} onClick={() => onSelectedChange(new Set())}>
                  모두 풀기
                </Button>
              </>
            ) : undefined
          }
        >
          1. 재료 고르기
        </SectionHeading>
        {materials.length === 0 ? (
          <EmptyState
            size="sm"
            title="재료함이 비어 있습니다"
            description="재료 없이도 과정 정보만으로 요청문을 만들 수 있습니다. 회의 기록이나 받아쓰기를 넣으면 초안이 훨씬 좋아집니다."
            action={
              <Link href={`/courses/${encodeURIComponent(course.id)}/materials`} className={buttonClasses("outline", "sm")}>
                재료함으로 가기
              </Link>
            }
          />
        ) : (
          <ul className="grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {materials.map((material) => (
              <li key={material.id}>
                <CheckboxRow
                  boxed
                  checked={selectedIds.has(material.id) && !material.excludeFromAi}
                  disabled={material.excludeFromAi}
                  onChange={(checked) => toggle(material.id, checked)}
                  label={material.title}
                  description={
                    material.excludeFromAi
                      ? "AI 제외 재료라 요청문에 넣지 않습니다"
                      : [
                          MATERIAL_KIND_LABELS[material.kind],
                          material.stage ? stageLabel(material.stage) : null,
                          material.kind === "link" ? null : `${material.body.length.toLocaleString("ko-KR")}자`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeading as="h3" description='예: "실습 비중을 늘려 줘", "임원 대상이라 사례 위주로". 비워도 됩니다.'>
          2. 추가 요청
        </SectionHeading>
        <Field id={ids.request} label="추가 요청">
          <Textarea
            id={ids.request}
            rows={3}
            value={request}
            maxLength={LIMITS.draftRequest}
            onChange={(event) => onRequestChange(event.target.value)}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeading
          as="h3"
          meta={`약 ${built.text.length.toLocaleString("ko-KR")}자`}
          description="복사한 요청문을 Claude나 ChatGPT 대화창에 붙여 넣고 보내세요."
        >
          3. 요청문 복사
        </SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCopy}>
            <CopyIcon />
            {label} 요청문 복사
          </Button>
          {AI_SITES.map((site) => (
            <a
              key={site.href}
              href={site.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("outline")}
            >
              {site.label}
              <span className="sr-only"> (새 탭에서 열림)</span>
            </a>
          ))}
        </div>
        {built.excludedIds.length > 0 ? (
          <p className="text-sm text-muted">AI 제외 재료 {built.excludedIds.length}개는 넣지 않았습니다.</p>
        ) : null}
        {built.cutIds.length > 0 ? (
          <Alert tone="warning" title="요청문이 너무 길어 재료 일부를 줄였습니다">
            재료 {built.cutIds.length}개의 뒷부분이 빠졌습니다. 꼭 필요한 재료만 고르면 빠짐없이 들어갑니다.
          </Alert>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={showPrompt}
          aria-controls={ids.prompt}
          onClick={() => setShowPrompt((value) => !value)}
        >
          {showPrompt ? "요청문 접기" : "요청문 보기"}
        </Button>
        {showPrompt ? (
          <Textarea id={ids.prompt} readOnly rows={12} value={built.text} aria-label={`${label} 요청문`} className="text-sm" />
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionHeading as="h3" description="AI가 준 답을 그대로 붙여 넣고 저장하면 새 판이 됩니다. 저장한 뒤에도 고칠 수 있습니다.">
          4. AI 답 붙여 넣기
        </SectionHeading>
        <Field
          id={ids.pasted}
          label={`${label} 초안`}
          hint={`${pasted.length.toLocaleString("ko-KR")} / ${LIMITS.draftContent.toLocaleString("ko-KR")}자`}
          error={contentError}
        >
          <Textarea
            id={ids.pasted}
            rows={12}
            value={pasted}
            maxLength={LIMITS.draftContent}
            placeholder={kind === "slides" ? "## 슬라이드 제목\n- 핵심 메시지\n노트: 발표 노트" : "# 제목\n## 소제목\n- 내용"}
            invalid={Boolean(contentError)}
            aria-describedby={describedBy(ids.pasted, { error: contentError, hint: true })}
            onChange={(event) => onPastedChange(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} loading={saving} loadingLabel="저장하는 중" disabled={pasted.trim().length === 0}>
            새 판으로 저장
          </Button>
          <Badge>재료 {built.includedIds.length}개 기록</Badge>
        </div>
        {saveError ? (
          <Alert tone="error" title="저장하지 못했습니다">
            {saveError}
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}

