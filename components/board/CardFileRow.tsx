"use client";

// 첨부 파일 한 줄: 이름(누르면 새 탭에서 열림), 크기·올린 사람·날짜, 지우기.
// 여는 주소는 줄이 보일 때 미리 받아 둔다. 누른 뒤에 받으면 브라우저가 새 탭을 팝업으로 보고 막는다.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import { FileIcon, TrashIcon } from "@/components/ui/icons";
import { deleteCardFile, getCardFileUrl } from "@/lib/data/cardFiles";
import { labelForEmail } from "@/lib/data/members";
import type { CardFile, Member } from "@/lib/data/types";
import { formatFileSize } from "@/lib/domain/cardFiles";
import { formatDateKo, todayInSeoul } from "@/lib/domain/dates";
import { toUserMessage } from "@/lib/domain/errors";

interface CardFileRowProps {
  courseId: string;
  file: CardFile;
  members: readonly Member[];
}

type UrlState = { status: "loading" } | { status: "ready"; url: string } | { status: "error"; message: string };

export function CardFileRow({ courseId, file, members }: CardFileRowProps) {
  const toast = useToast();
  const [attempt, setAttempt] = useState(0);
  const [urlState, setUrlState] = useState<UrlState>({ status: "loading" });
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 목록이 새로 들어올 때마다(다른 파일이 바뀌어도) 다시 받지 않도록 저장 위치가 바뀔 때만 받는다
  const storagePath = file.storagePath;
  useEffect(() => {
    let cancelled = false;
    getCardFileUrl(storagePath).then(
      (url) => {
        if (!cancelled) setUrlState({ status: "ready", url });
      },
      (error: unknown) => {
        if (!cancelled) setUrlState({ status: "error", message: toUserMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storagePath, attempt]);

  function retryUrl() {
    setUrlState({ status: "loading" });
    setAttempt((count) => count + 1);
  }

  async function handleDelete() {
    await deleteCardFile(courseId, file);
    toast.success(`"${file.name}" 파일을 지웠습니다.`);
  }

  const uploader = file.createdBy ? labelForEmail(file.createdBy, members) : "";
  const uploadedOn = file.createdAt !== null ? formatDateKo(todayInSeoul(new Date(file.createdAt))) : "";
  const details = [formatFileSize(file.size), uploader, uploadedOn].filter(Boolean).join(" · ");

  return (
    <li className="flex items-start gap-2 rounded-card border border-line bg-white p-2">
      <FileIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {urlState.status === "ready" ? (
          <a
            href={urlState.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "break-anywhere rounded-sm text-sm font-semibold text-primary underline-offset-2 hover:underline",
              focusRing,
            )}
          >
            {file.name}
            <span className="sr-only"> (새 탭에서 열림)</span>
          </a>
        ) : (
          <span className="break-anywhere text-sm font-semibold text-ink">{file.name}</span>
        )}
        <span className="text-xs text-muted">{details}</span>
        {urlState.status === "loading" ? <span className="text-xs text-muted">여는 주소를 받는 중…</span> : null}
        {urlState.status === "error" ? (
          <span className="flex flex-wrap items-center gap-2 text-xs text-danger">
            {urlState.message}
            <Button variant="ghost" size="sm" onClick={retryUrl}>
              다시 시도
              <span className="sr-only">({file.name} 열기)</span>
            </Button>
          </span>
        ) : null}
      </div>
      <IconButton
        label={`"${file.name}" 지우기`}
        icon={<TrashIcon />}
        tone="danger"
        onClick={() => setDeleteOpen(true)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="이 파일을 지울까요?"
        description={`"${file.name}" 파일이 바로 지워지고 되살릴 수 없습니다. 다른 팀원도 더 이상 이 파일을 열 수 없습니다.`}
        confirmLabel="지우기"
        tone="danger"
      />
    </li>
  );
}
