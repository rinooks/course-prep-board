"use client";

// 올릴 파일 대기열: 파일마다 이름·크기와 상태(기다리는 중 / 진행률 / 저장 중 / 실패 이유)를 보여준다.
// 기다리거나 실패한 파일은 뺄 수 있고, 올리는 중인 파일은 취소할 수 있다.

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CloseIcon, FileIcon } from "@/components/ui/icons";
import { formatFileSize } from "@/lib/domain/cardFiles";
import type { UploadItem } from "./useFileUploads";

interface UploadQueueListProps {
  items: readonly UploadItem[];
  onRemove: (key: string) => void;
  /** 대기열 이름 (화면 낭독기용). 예: "올릴 파일" */
  label: string;
}

function statusText(item: UploadItem): string {
  switch (item.status) {
    case "waiting":
      return "올리기 전";
    case "uploading":
      return `올리는 중 ${item.percent}%`;
    case "saving":
      return "저장하는 중…";
    case "failed":
      return "올리지 못함";
  }
}

export function UploadQueueList({ items, onRemove, label }: UploadQueueListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-2 rounded-card border border-line bg-white p-2">
          <div className="flex items-center gap-2">
            <FileIcon className="h-5 w-5 shrink-0 text-muted" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="break-anywhere text-sm font-semibold text-ink">{item.name}</span>
              <span className="text-xs text-muted">
                {formatFileSize(item.size)} · {statusText(item)}
              </span>
            </div>
            {item.status === "uploading" ? (
              <Button variant="ghost" size="sm" onClick={() => onRemove(item.key)}>
                취소
                <span className="sr-only">({item.name} 올리기)</span>
              </Button>
            ) : item.status === "waiting" || item.status === "failed" ? (
              <IconButton label={`"${item.name}" 목록에서 빼기`} icon={<CloseIcon className="h-4 w-4" />} onClick={() => onRemove(item.key)} />
            ) : null}
          </div>
          {item.status === "uploading" || item.status === "saving" ? (
            <ProgressBar percent={item.percent} label={`${item.name} 올리는 중`} />
          ) : null}
          {item.status === "failed" && item.error ? (
            <p className="text-sm leading-relaxed text-danger">{item.error}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
