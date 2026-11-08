"use client";

// 칸 맨 아래 "카드 추가". 제목을 쓰고 Enter(한글 조합 중 Enter는 무시)나 추가 버튼으로 만든다.
// 실패하면 쓴 제목은 그대로 두고, 같은 제목으로 다시 누르면 같은 id로 보내 카드가 두 장 생기지 않는다.
// 제목을 바꿔 다시 보내면 새 id를 쓴다 (바뀐 제목이 저장되지 않고 성공처럼 보이는 일을 막는다).
//
// 파일 첨부: 추가 전에 파일을 골라 두면 카드를 만든 뒤 차례로 올린다.
// 카드는 만들었는데 일부 파일이 실패하면, 카드를 또 만들지 않고 실패한 파일만 다시 올릴 수 있게 한다.

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { describedBy, FieldError } from "@/components/ui/Field";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useImeSafeEnter } from "@/components/ui/useImeSafeEnter";
import { useRetryId } from "@/components/ui/useRetryId";
import { createCard } from "@/lib/data/cards";
import { orderAtEnd } from "@/lib/domain/ordering";
import type { StageId } from "@/lib/domain/stages";
import { LIMITS } from "@/lib/domain/validation";
import { PlusIcon } from "@/components/ui/icons";
import { FilePickButton } from "./FilePickButton";
import { UploadQueueList } from "./UploadQueueList";
import { useFileUploads } from "./useFileUploads";

interface AddCardFormProps {
  courseId: string;
  stageId: StageId;
  stageLabel: string;
  /** 이 칸에 있는 카드들의 order (새 카드는 맨 끝에 붙는다) */
  orders: readonly number[];
}

/** 만들었지만 파일 일부를 올리지 못한 카드 */
interface MadeCard {
  id: string;
  title: string;
}

export function AddCardForm({ courseId, stageId, stageLabel, orders }: AddCardFormProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [madeCard, setMadeCard] = useState<MadeCard | null>(null);
  const retryIds = useRetryId();
  const uploads = useFileUploads();

  const add = useAsyncAction((value: string, cardId: string) =>
    createCard(courseId, { stage: stageId, title: value, order: orderAtEnd(orders) }, { id: cardId }),
  );

  /** 대기열의 파일을 카드에 올린다. 하나라도 실패하면 "다시 올리기" 상태로 바꾼다 */
  async function uploadTo(card: MadeCard, retryFailed: boolean) {
    const allDone = await uploads.start(courseId, card.id, { retryFailed });
    if (allDone) {
      setMadeCard(null);
      inputRef.current?.focus();
    } else {
      setMadeCard(card);
    }
  }

  async function submit() {
    if (add.pending || uploads.busy || madeCard) return;
    const submittedTitle = title;
    const hasFiles = uploads.items.length > 0;
    const result = await add.run(submittedTitle, retryIds.idFor(submittedTitle));
    if (!result.ok) return;
    setTitle("");
    setRejected([]);
    retryIds.reset();
    if (!hasFiles) {
      inputRef.current?.focus();
      return;
    }
    await uploadTo({ id: result.value, title: submittedTitle.trim() }, false);
  }

  function handlePick(files: File[]) {
    setRejected(uploads.add(files, 0));
  }

  /** 올리지 못한 파일은 두고 카드만 남긴다 */
  function giveUpFiles() {
    uploads.clear();
    setMadeCard(null);
  }

  function close() {
    if (uploads.busy) return;
    add.reset();
    uploads.clear();
    setRejected([]);
    setMadeCard(null);
    setOpen(false);
  }

  const handleEnter = useImeSafeEnter(() => {
    void submit();
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      close();
      return;
    }
    handleEnter(event);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon />
        카드 추가
        <span className="sr-only">({stageLabel} 단계)</span>
      </Button>
    );
  }

  const rejectedNotice =
    rejected.length > 0 ? (
      <Alert tone="warning" title="넣지 못한 파일이 있습니다">
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </Alert>
    ) : null;

  // 카드는 만들었고 파일 일부만 실패한 상태: 카드를 또 만들지 않도록 제목 칸 대신 다시 올리기를 보여준다
  if (madeCard) {
    return (
      <div className="flex flex-col gap-2">
        <Alert tone="warning" title={`"${madeCard.title}" 카드는 만들었습니다`}>
          파일 일부를 올리지 못했습니다. 파일마다 적힌 안내를 확인한 뒤 다시 올리거나, 나중에 카드를 열어 올려도 됩니다.
        </Alert>
        <UploadQueueList items={uploads.items} onRemove={uploads.remove} label="올리지 못한 파일" />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void uploadTo(madeCard, true)}
            loading={uploads.busy}
            loadingLabel="파일을 올리는 중"
          >
            다시 올리기
          </Button>
          <Button variant="ghost" size="sm" onClick={giveUpFiles} disabled={uploads.busy}>
            파일 없이 마치기
          </Button>
        </div>
      </div>
    );
  }

  const titleError = add.fieldErrors.title ?? null;
  const otherError = add.error && !titleError ? add.error : null;
  const working = add.pending || uploads.busy;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        {stageLabel} 단계에 추가할 카드 제목
      </label>
      <Input
        id={inputId}
        ref={inputRef}
        autoFocus
        value={title}
        maxLength={LIMITS.cardTitle}
        placeholder="카드 제목을 입력하고 Enter"
        invalid={Boolean(titleError)}
        aria-describedby={describedBy(inputId, { error: titleError })}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <FieldError id={inputId}>{titleError}</FieldError>
      {otherError ? <Alert tone="error">{otherError}</Alert> : null}
      <UploadQueueList items={uploads.items} onRemove={uploads.remove} label="카드에 붙일 파일" />
      {rejectedNotice}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          loading={working}
          loadingLabel={uploads.busy ? "파일을 올리는 중" : "카드를 만드는 중"}
        >
          추가
        </Button>
        <FilePickButton variant="ghost" onPick={handlePick} disabled={working}>
          파일 첨부
        </FilePickButton>
        <Button variant="ghost" size="sm" onClick={close} disabled={working}>
          닫기
        </Button>
      </div>
    </form>
  );
}
