"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { Member } from "@/lib/data/types";
import { isBootstrapAdmin, roleLabel } from "@/lib/domain/roles";
import {
  displayLabel,
  isSelf,
  lockReason,
  memberActivityText,
  memberInitial,
  memberLock,
  nextRole,
  roleChangeLabel,
  type MemberAction,
} from "./memberRules";

interface MemberRowProps {
  member: Member;
  /** 지금 로그인한 관리자 이메일 */
  actorEmail: string | null;
  /** 지금 시각(밀리초). "오늘·어제" 표시에 쓴다 */
  nowMs: number;
  onRequestAction: (action: MemberAction) => void;
}

/** 팀원 한 줄: 이름·이메일·역할·마지막 로그인 + 역할 변경·내보내기 버튼 */
export function MemberRow({ member, actorEmail, nowMs, onRequestAction }: MemberRowProps) {
  const label = displayLabel(member);
  const hasName = member.displayName.trim().length > 0;
  const lock = memberLock(member.email, actorEmail);
  const self = isSelf(member.email, actorEmail);
  const changeLabel = roleChangeLabel(member.role);

  return (
    <li>
      <Card padding="sm" flat className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary"
          >
            {memberInitial(member)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className={cn("font-semibold text-ink", !hasName && "break-anywhere")}>{label}</p>
            {hasName ? <p className="break-anywhere text-sm text-muted">{member.email}</p> : null}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={member.role === "admin" ? "primary" : "neutral"}>{roleLabel(member.role)}</Badge>
              {self ? <Badge>나</Badge> : null}
              {isBootstrapAdmin(member.email) ? <Badge>첫 관리자</Badge> : null}
              {member.lastLoginAt === null ? <Badge tone="warning">로그인 전</Badge> : null}
            </div>
            <p className="text-sm text-muted">{memberActivityText(member, nowMs)}</p>
          </div>
        </div>

        {lock ? (
          <p className="text-sm leading-relaxed text-muted md:max-w-xs md:text-right">{lockReason(lock)}</p>
        ) : (
          <div className="grid shrink-0 grid-cols-2 gap-2 md:flex">
            <Button
              variant="outline"
              size="sm"
              aria-label={`${label} ${changeLabel}`}
              onClick={() => onRequestAction({ kind: "changeRole", member, nextRole: nextRole(member.role) })}
            >
              {changeLabel}
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              aria-label={`${label} 내보내기`}
              onClick={() => onRequestAction({ kind: "remove", member })}
            >
              내보내기
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
