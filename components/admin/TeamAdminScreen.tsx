"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { BentoGrid } from "@/components/ui/Bento";
import { InviteMemberForm } from "./InviteMemberForm";
import { MemberActionDialog } from "./MemberActionDialog";
import { MembersSection } from "./MembersSection";
import { NotifyEmailSection } from "./NotifyEmailSection";
import type { MemberAction } from "./memberRules";
import { useMembers } from "./useMembers";

/** /admin 팀 관리 화면. AppShell 안의 RequireAdmin 안에서 쓴다. */
export function TeamAdminScreen() {
  const { email: actorEmail } = useAuth();
  const { members, error, retry } = useMembers();
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<MemberAction | null>(null);

  function focusInvite() {
    const input = inviteInputRef.current;
    if (!input) return;
    input.scrollIntoView({ block: "center" });
    input.focus();
  }

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="팀 관리"
        description="초대한 구글 계정만 앱에 들어올 수 있습니다. 강사를 초대하고, 관리자를 지정하고, 팀에서 내보낼 수 있습니다."
      />
      <PageBody>
        {/* 휴대폰에서는 초대 칸을 먼저, 넓은 화면에서는 오른쪽에 둔다 */}
        <BentoGrid layout="main-side">
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:self-start">
            <InviteMemberForm members={members ?? []} inputRef={inviteInputRef} />
            <NotifyEmailSection />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <MembersSection
              members={members}
              error={error}
              onRetry={retry}
              actorEmail={actorEmail}
              onRequestAction={setPendingAction}
              onStartInvite={focusInvite}
            />
          </div>
        </BentoGrid>

        {pendingAction ? (
          <MemberActionDialog action={pendingAction} onClose={() => setPendingAction(null)} />
        ) : null}
      </PageBody>
    </>
  );
}
