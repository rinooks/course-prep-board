"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { LoadingBlock } from "@/components/ui/Spinner";
import type { Member } from "@/lib/data/types";
import { MemberRow } from "./MemberRow";
import { isSelf, summarizeMembers, summaryText, type MemberAction } from "./memberRules";
import { useMinuteClock } from "./useMinuteClock";

interface MembersSectionProps {
  /** 아직 못 받았으면 null */
  members: Member[] | null;
  error: string | null;
  onRetry: () => void;
  actorEmail: string | null;
  onRequestAction: (action: MemberAction) => void;
  /** 빈 목록 안내에서 초대 칸으로 이동 */
  onStartInvite: () => void;
}

/** 팀원 목록 영역: 불러오는 중 / 오류 / 빈 목록 / 목록 */
export function MembersSection({
  members,
  error,
  onRetry,
  actorEmail,
  onRequestAction,
  onStartInvite,
}: MembersSectionProps) {
  const nowMs = useMinuteClock();
  const loading = members === null && error === null;
  // 나 말고 다른 팀원이 없으면 초대를 권한다
  const onlyMe = members !== null && members.every((member) => isSelf(member.email, actorEmail));

  return (
    <Section
      tile
      title="팀원"
      meta={members && members.length > 0 ? summaryText(summarizeMembers(members)) : null}
    >
      {error ? (
        <Alert
          tone="error"
          title="팀원 목록을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {loading ? <LoadingBlock label="팀원 목록을 불러오는 중입니다…" /> : null}

      {members && members.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <MemberRow
              key={member.email}
              member={member}
              actorEmail={actorEmail}
              nowMs={nowMs}
              onRequestAction={onRequestAction}
            />
          ))}
        </ul>
      ) : null}

      {onlyMe ? (
        <EmptyState
          title="아직 초대한 강사가 없습니다"
          description="동료 강사의 구글 계정 이메일을 강사 초대 칸에 넣으면, 그 계정으로 바로 로그인해 함께 쓸 수 있습니다."
          action={
            <Button variant="outline" onClick={onStartInvite}>
              초대할 이메일 입력하기
            </Button>
          }
        />
      ) : null}
    </Section>
  );
}
