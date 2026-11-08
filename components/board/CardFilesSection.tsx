"use client";

// 카드 상세의 첨부 파일: 붙은 파일 목록 + 파일 올리기 + 올리는 중인 대기열.
// 파일을 고르는 즉시 올리기 시작한다 (위 "변경 내용 저장"과 상관없다).
// 다른 강사가 올리거나 지운 파일도 새로고침 없이 바로 보인다.
// 올리기 대기열(uploads)은 부모(CardDetailModal)가 들고 있어서, 올리는 중에 창을 닫으려 하면 물어볼 수 있다.

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import type { CardFile, Member } from "@/lib/data/types";
import { CARD_FILE_HINT, fileSlotsLeft } from "@/lib/domain/cardFiles";
import { CardFileRow } from "./CardFileRow";
import { FilePickButton } from "./FilePickButton";
import { UploadQueueList } from "./UploadQueueList";
import type { FileUploads } from "./useFileUploads";

interface CardFilesSectionProps {
  courseId: string;
  cardId: string;
  /** 이 카드의 파일 (올린 순서) */
  files: readonly CardFile[];
  loaded: boolean;
  error: string | null;
  onRetry: () => void;
  members: readonly Member[];
  uploads: FileUploads;
  headingId: string;
}

export function CardFilesSection({
  courseId,
  cardId,
  files,
  loaded,
  error,
  onRetry,
  members,
  uploads,
  headingId,
}: CardFilesSectionProps) {
  const [rejected, setRejected] = useState<string[]>([]);
  const slotsLeft = fileSlotsLeft(files.length + uploads.items.length);

  function handlePick(picked: File[]) {
    setRejected(uploads.add(picked, files.length));
    void uploads.start(courseId, cardId);
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <SectionHeading
        as="h3"
        id={headingId}
        meta={files.length > 0 ? `${files.length}개` : undefined}
        description={CARD_FILE_HINT}
        action={
          <FilePickButton onPick={handlePick} disabled={!loaded || slotsLeft === 0}>
            파일 올리기
          </FilePickButton>
        }
      >
        첨부 파일
      </SectionHeading>

      {error ? (
        <Alert
          tone="error"
          title="첨부 파일 목록을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {rejected.length > 0 ? (
        <Alert
          tone="warning"
          title="넣지 못한 파일이 있습니다"
          action={
            <Button variant="ghost" size="sm" onClick={() => setRejected([])}>
              안내 닫기
            </Button>
          }
        >
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {rejected.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {!loaded && !error ? <InlineLoading label="첨부 파일을 불러오는 중입니다…" /> : null}

      {loaded && files.length === 0 && uploads.items.length === 0 ? (
        <p className="text-sm text-muted">아직 붙인 파일이 없습니다. &lsquo;파일 올리기&rsquo;로 여러 개를 한 번에 고를 수 있습니다.</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="붙은 파일">
          {files.map((file) => (
            <CardFileRow key={file.id} courseId={courseId} file={file} members={members} />
          ))}
        </ul>
      ) : null}

      <UploadQueueList items={uploads.items} onRemove={uploads.remove} label="올리는 파일" />

      {uploads.hasFailed && !uploads.busy ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => void uploads.start(courseId, cardId, { retryFailed: true })}>
            실패한 파일 다시 올리기
          </Button>
        </div>
      ) : null}
    </section>
  );
}
