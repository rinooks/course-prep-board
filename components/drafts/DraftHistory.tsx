"use client";

// 초안 기록: 이 종류의 판 목록(최근 10판)과, 고른 판 보기·고치기·확정하기.
// 확정하면 그 순간의 내용이 결과물로 복사된다. 확정한 뒤 초안을 고쳐도 결과물은 바뀌지 않는다.

import { useId, useState } from "react";
import Link from "next/link";
import { MarkdownView } from "@/components/course/MarkdownView";
import { epochDateLabel } from "@/components/home/labels";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { copyText } from "@/components/ui/copyText";
import { EmptyState } from "@/components/ui/EmptyState";
import { describedBy, Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { rowClass } from "@/components/ui/Row";
import { SectionHeading } from "@/components/ui/Section";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { confirmDraft, deleteDraft, updateDraftContent } from "@/lib/data/drafts";
import { labelForEmail } from "@/lib/data/members";
import type { Draft, Member, Output } from "@/lib/data/types";
import { DRAFT_HISTORY_LIMIT, DRAFT_KIND_LABELS, type DraftKind } from "@/lib/domain/drafts";
import { LIMITS } from "@/lib/domain/validation";

interface DraftHistoryProps {
  courseId: string;
  kind: DraftKind;
  /** 이 종류의 초안 (최신 판이 앞) */
  drafts: readonly Draft[];
  /** 이 과정의 결과물 전체 (확정 여부·판 번호 계산용) */
  outputs: readonly Output[];
  members: readonly Member[];
  selectedId: string | null;
  onSelect: (draftId: string) => void;
}

export function DraftHistory({ courseId, kind, drafts, outputs, members, selectedId, onSelect }: DraftHistoryProps) {
  const label = DRAFT_KIND_LABELS[kind];
  const selected = drafts.find((draft) => draft.id === selectedId) ?? drafts[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <SectionHeading
          as="h3"
          meta={`${drafts.length}판`}
          description={`종류별로 최근 ${DRAFT_HISTORY_LIMIT}판까지 남고, 그보다 오래된 판은 새 판을 저장할 때 지워집니다.`}
        >
          {label} 기록
        </SectionHeading>
        {drafts.length === 0 ? (
          <EmptyState
            size="sm"
            title={`아직 저장한 ${label} 초안이 없습니다`}
            description="왼쪽 4단계를 따라 AI 답을 붙여 넣고 저장하면 여기에 판이 쌓입니다."
          />
        ) : (
          <ul className="-mx-3 flex flex-col">
            {drafts.map((draft) => {
              const current = draft.id === selected?.id;
              const confirmed = outputs.some((output) => output.sourceDraftId === draft.id && output.deletedAt === null);
              return (
                <li key={draft.id}>
                  <button
                    type="button"
                    aria-current={current ? "true" : undefined}
                    onClick={() => onSelect(draft.id)}
                    className={cn(rowClass, "w-full", current && "bg-primary/5", focusRing)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-base font-semibold", current ? "text-primary" : "text-ink")}>
                        {draft.version}판
                      </span>
                      {confirmed ? <Badge tone="success">확정함</Badge> : null}
                    </span>
                    <span className="text-sm text-muted">
                      {labelForEmail(draft.createdBy, members)}
                      {draft.createdAt ? ` · ${epochDateLabel(draft.createdAt)}` : ""}
                      {draft.materialIds.length > 0 ? ` · 재료 ${draft.materialIds.length}개` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {selected ? (
        <DraftViewer
          // 다른 판을 고르면 고치던 상태를 새로 시작한다
          key={selected.id}
          courseId={courseId}
          draft={selected}
          outputs={outputs}
        />
      ) : null}
    </div>
  );
}

function DraftViewer({ courseId, draft, outputs }: { courseId: string; draft: Draft; outputs: readonly Output[] }) {
  const baseId = useId();
  const toast = useToast();
  const retryIds = useRetryId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.content);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const label = DRAFT_KIND_LABELS[draft.kind];
  const editorId = `${baseId}-editor`;

  const save = useAsyncAction((content: string) => updateDraftContent(courseId, draft.id, content));
  const confirm = useAsyncAction(() =>
    // 같은 판을 두 번 눌러도 결과물이 두 개 생기지 않게, 판마다 같은 id를 쓴다
    confirmDraft(courseId, draft, outputs, { id: retryIds.idFor(`${draft.id}:${draft.content}`) }),
  );

  async function handleSave() {
    const result = await save.run(text);
    if (result.ok) {
      setEditing(false);
      toast.success(`${draft.version}판을 고쳤습니다.`);
    }
  }

  async function handleConfirm() {
    const result = await confirm.run();
    if (result.ok) {
      retryIds.reset();
      setConfirmedId(result.value);
      toast.success(`${label} ${draft.version}판을 확정했습니다. 결과물 탭에서 내려받을 수 있습니다.`);
    }
  }

  async function handleCopy() {
    const ok = await copyText(draft.content);
    if (ok) toast.success("초안 내용을 복사했습니다.");
    else toast.error("복사하지 못했습니다. '고치기'를 눌러 내용 칸에서 전체 선택(Ctrl+A)한 뒤 복사해 주세요.");
  }

  async function handleDelete() {
    await deleteDraft(courseId, draft.id);
    toast.success(`${label} ${draft.version}판을 지웠습니다.`);
  }

  // 지금 내용 그대로 이미 확정했으면 다시 확정하지 않는다 (같은 결과물이 두 판 생기지 않게).
  // 확정한 뒤 초안을 고쳤다면 다시 확정할 수 있다.
  const alreadyConfirmed = outputs.some(
    (output) => output.sourceDraftId === draft.id && output.deletedAt === null && output.content === draft.content,
  );

  const contentError = save.fieldErrors.content;

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeading
        as="h3"
        description="확정하면 지금 내용이 결과물로 복사됩니다. 확정한 뒤 초안을 고쳐도 결과물은 바뀌지 않습니다."
        action={
          editing ? null : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={confirm.pending}>
                고치기
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                복사
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                loading={confirm.pending}
                loadingLabel="확정하는 중"
                disabled={alreadyConfirmed}
              >
                {alreadyConfirmed ? "확정함" : "확정하기"}
              </Button>
              <Button variant="dangerGhost" size="sm" onClick={() => setDeleteOpen(true)} disabled={confirm.pending}>
                이 판 지우기
              </Button>
            </>
          )
        }
      >
        {label} {draft.version}판
      </SectionHeading>

      {confirmedId ? (
        <Alert
          tone="success"
          title="결과물로 확정했습니다"
          action={
            <Link href={`/courses/${encodeURIComponent(courseId)}/outputs`} className={buttonClasses("outline", "sm")}>
              결과물 보기
            </Link>
          }
        >
          PPT·PDF 내려받기와 최종본 링크는 결과물 탭에서 합니다.
        </Alert>
      ) : null}
      {confirm.error ? (
        <Alert tone="error" title="확정하지 못했습니다">
          {confirm.error}
        </Alert>
      ) : null}

      {editing ? (
        <div className="flex flex-col gap-3">
          <Field
            id={editorId}
            label="초안 내용"
            hint={`${text.length.toLocaleString("ko-KR")} / ${LIMITS.draftContent.toLocaleString("ko-KR")}자`}
            error={contentError}
          >
            <Textarea
              id={editorId}
              rows={18}
              value={text}
              maxLength={LIMITS.draftContent}
              invalid={Boolean(contentError)}
              aria-describedby={describedBy(editorId, { error: contentError, hint: true })}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} loading={save.pending} loadingLabel="저장하는 중">
              저장
            </Button>
            <Button
              variant="outline"
              disabled={save.pending}
              onClick={() => {
                setText(draft.content);
                setEditing(false);
                save.reset();
              }}
            >
              취소
            </Button>
          </div>
          {save.error && !contentError ? (
            <Alert tone="error" title="저장하지 못했습니다">
              {save.error}
            </Alert>
          ) : null}
        </div>
      ) : (
        <Card flat tone="surface" className="max-h-[36rem] overflow-y-auto">
          <MarkdownView markdown={draft.content} />
        </Card>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`${label} ${draft.version}판을 지울까요?`}
        description="지운 판은 되살릴 수 없습니다. 이 판으로 이미 확정한 결과물은 결과물 탭에 그대로 남습니다."
        confirmLabel="지우기"
        tone="danger"
      />
    </Card>
  );
}
