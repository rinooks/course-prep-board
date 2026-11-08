// 재료함 목록의 재료 하나: 종류·단계·"AI 제외" 표시, 제목(누르면 열기), 본문 앞부분 또는 링크, 올린 사람·날짜.

import { epochDateLabel } from "@/components/home/labels";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { LinkIcon } from "@/components/ui/icons";
import { labelForEmail } from "@/lib/data/members";
import type { Material, Member } from "@/lib/data/types";
import { MATERIAL_KIND_LABELS } from "@/lib/domain/materials";
import { stageLabel } from "@/lib/domain/stages";

interface MaterialCardProps {
  material: Material;
  members: readonly Member[];
  onOpen: () => void;
}

export function MaterialCard({ material, members, onOpen }: MaterialCardProps) {
  const author = labelForEmail(material.createdBy, members);
  const date = epochDateLabel(material.createdAt);

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{MATERIAL_KIND_LABELS[material.kind]}</Badge>
        {material.stage ? <Badge tone="primary">{stageLabel(material.stage)}</Badge> : null}
        {material.excludeFromAi ? <Badge tone="warning">AI 제외</Badge> : null}
      </div>

      <h3 className="text-lg font-bold tracking-tight text-ink text-balance">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "rounded-button text-left transition hover:text-primary hover:underline motion-reduce:transition-none",
            focusRing,
          )}
        >
          {material.title}
          <span className="sr-only"> 열기</span>
        </button>
      </h3>

      {material.kind === "link" ? (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-11 items-center gap-2 self-start rounded-button text-sm font-semibold text-primary hover:underline",
            focusRing,
          )}
        >
          <LinkIcon />
          <span className="break-anywhere">{material.url}</span>
          <span className="sr-only">(새 탭에서 열림)</span>
        </a>
      ) : null}

      {material.body ? (
        <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted">{material.body}</p>
      ) : null}
      {material.memo ? <p className="text-sm text-ink">메모: {material.memo}</p> : null}

      <p className="mt-auto text-sm text-muted">
        <span className={author.includes("@") ? "break-anywhere" : undefined}>{author}</span>
        {date ? ` · ${date}` : ""}
        {material.kind !== "link" ? ` · ${material.body.length.toLocaleString("ko-KR")}자` : ""}
      </p>
    </Card>
  );
}
