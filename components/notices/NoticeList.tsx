"use client";

import { Badge } from "@/components/ui/Badge";
import { RowLink } from "@/components/ui/Row";
import type { Notice } from "@/lib/domain/notices";

interface NoticeListProps {
  notices: readonly Notice[];
  /** 알림을 눌러 다른 화면으로 갈 때 (종 패널 닫기 등) */
  onNavigate?: () => void;
}

/** 알림 목록: 배지(내일 강의·미입금) + 굵은 첫 줄 + 작은 둘째 줄. 머리글 종 패널과 홈 띠가 같이 쓴다 */
export function NoticeList({ notices, onNavigate }: NoticeListProps) {
  return (
    <ul className="-mx-3 flex flex-col">
      {notices.map((notice) => (
        <li key={notice.id}>
          <RowLink href={notice.href} onClick={onNavigate}>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={notice.kind === "overdueFee" ? "danger" : "warning"}>{notice.label}</Badge>
              <span className="font-semibold text-ink">{notice.text}</span>
            </span>
            {notice.detail ? (
              // 강사 이름이 없으면 이메일이 나오므로 칸을 넘치지 않게 끊는다
              <span className={notice.detail.includes("@") ? "break-anywhere text-sm text-muted" : "text-sm text-muted"}>
                {notice.detail}
              </span>
            ) : null}
          </RowLink>
        </li>
      ))}
    </ul>
  );
}
