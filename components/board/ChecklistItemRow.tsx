"use client";

// 체크리스트 항목 한 줄: 체크, 글 고치기, 위·아래로 옮기기, 지우기.
// 체크는 항목마다 따로 저장되어 두 사람이 동시에 체크해도 서로 덮어쓰지 않는다.
// 지우기는 되살릴 수 없어서 한 번 더 묻는다.

import { useId, useState, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { describedBy, FieldError } from "@/components/ui/Field";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useImeSafeEnter } from "@/components/ui/useImeSafeEnter";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import {
  deleteChecklistItem,
  reorderChecklistItem,
  setChecklistItemDone,
  updateChecklistItemText,
} from "@/lib/data/checklist";
import type { ChecklistItem } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";
import { LIMITS } from "@/lib/domain/validation";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";

interface ChecklistItemRowProps {
  courseId: string;
  item: ChecklistItem;
  /** 같은 카드의 항목들 (화면 순서) */
  siblings: readonly ChecklistItem[];
  index: number;
}

type Mode = "view" | "edit" | "confirmDelete";

export function ChecklistItemRow({ courseId, item, siblings, index }: ChecklistItemRowProps) {
  const inputId = useId();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(item.text);

  const saveText = useAsyncAction((text: string) => updateChecklistItemText(courseId, item.id, text));
  const remove = useAsyncAction(() => deleteChecklistItem(courseId, item.id));
  const reorder = useAsyncAction((targetIndex: number) =>
    reorderChecklistItem(
      courseId,
      item.id,
      siblings.map((sibling) => ({ id: sibling.id, order: sibling.order })),
      targetIndex,
    ),
  );

  function toggle(done: boolean) {
    setChecklistItemDone(courseId, item.id, done).catch((error: unknown) => {
      toast.error(toUserMessage(error));
    });
  }

  function startEdit() {
    saveText.reset();
    setDraft(item.text);
    setMode("edit");
  }

  async function submitText() {
    if (saveText.pending) return;
    if (draft === item.text) {
      setMode("view");
      return;
    }
    const result = await saveText.run(draft);
    if (result.ok) setMode("view");
  }

  const handleEnter = useImeSafeEnter(() => {
    void submitText();
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      // 상세 창까지 닫히지 않게 여기서 멈춘다
      event.preventDefault();
      event.nativeEvent.stopImmediatePropagation();
      setMode("view");
      return;
    }
    handleEnter(event);
  }

  function move(offset: number) {
    // 실패 문구는 reorder.error로 이 줄 아래에 보인다
    void reorder.run(index + offset);
  }

  async function confirmDelete() {
    const result = await remove.run();
    if (result.ok) setMode("view");
  }

  if (mode === "edit") {
    const textError = saveText.fieldErrors.text ?? null;
    return (
      <li className="flex flex-col gap-2 rounded-card border border-primary/20 bg-white p-2">
        <label htmlFor={inputId} className="sr-only">
          체크리스트 항목 고치기
        </label>
        <Input
          id={inputId}
          autoFocus
          value={draft}
          maxLength={LIMITS.checklistText}
          invalid={Boolean(textError)}
          aria-describedby={describedBy(inputId, { error: textError })}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <FieldError id={inputId}>{textError}</FieldError>
        {saveText.error && !textError ? (
          <Alert tone="error" title="항목을 저장하지 못했습니다">
            {saveText.error}
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("view")} disabled={saveText.pending}>
            취소
          </Button>
          <Button size="sm" onClick={submitText} loading={saveText.pending} loadingLabel="저장하는 중">
            저장
          </Button>
        </div>
      </li>
    );
  }

  const busyError = reorder.error ?? remove.error;
  const busyErrorTitle = reorder.error ? "항목을 옮기지 못했습니다" : "항목을 지우지 못했습니다";

  return (
    <li className="rounded-card border border-line bg-white p-1">
      <div className="flex flex-col gap-1 md:flex-row md:items-center">
        <label
          className={cn(
            "flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-card px-3 py-2.5",
            "transition motion-reduce:transition-none hover:bg-ink/5",
          )}
        >
          <input
            type="checkbox"
            checked={item.done}
            onChange={(event) => toggle(event.target.checked)}
            className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary", focusRing)}
          />
          <span className={cn("text-sm leading-relaxed", item.done ? "text-muted line-through" : "text-ink")}>
            {item.text}
          </span>
        </label>

        {mode === "confirmDelete" ? (
          <div className="flex items-center justify-end gap-2 px-1" role="group" aria-label="항목 지우기 확인">
            <span className="text-sm text-ink">지울까요?</span>
            <Button variant="ghost" size="sm" onClick={() => setMode("view")} disabled={remove.pending}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              loading={remove.pending}
              loadingLabel="지우는 중"
            >
              지우기
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            <IconButton
              label={`위로 옮기기: ${item.text}`}
              icon={<ArrowUpIcon />}
              onClick={() => move(-1)}
              disabled={index === 0 || reorder.pending}
            />
            <IconButton
              label={`아래로 옮기기: ${item.text}`}
              icon={<ArrowDownIcon />}
              onClick={() => move(1)}
              disabled={index === siblings.length - 1 || reorder.pending}
            />
            <IconButton label={`고치기: ${item.text}`} icon={<PencilIcon />} onClick={startEdit} />
            <IconButton
              label={`지우기: ${item.text}`}
              icon={<TrashIcon />}
              tone="danger"
              onClick={() => {
                remove.reset();
                setMode("confirmDelete");
              }}
            />
          </div>
        )}
      </div>

      {busyError ? (
        <div className="px-1 pb-1">
          <Alert tone="error" title={busyErrorTitle}>
            {busyError}
          </Alert>
        </div>
      ) : null}
    </li>
  );
}
