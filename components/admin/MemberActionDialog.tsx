"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { changeMemberRole, removeMember } from "@/lib/data/members";
import { describeMemberAction, type MemberAction } from "./memberRules";

interface MemberActionDialogProps {
  action: MemberAction;
  onClose: () => void;
}

/**
 * 역할 변경·내보내기 확인 창.
 * 실패하면 창 안에 다음 할 일을 안내하고(ConfirmDialog), 성공하면 닫고 알림을 띄운다.
 * 목록은 실시간 구독이 알아서 갱신한다.
 */
export function MemberActionDialog({ action, onClose }: MemberActionDialogProps) {
  const toast = useToast();
  const copy = describeMemberAction(action);

  async function confirm() {
    if (action.kind === "remove") {
      await removeMember(action.member.email);
    } else {
      await changeMemberRole(action.member.email, action.nextRole);
    }
    toast.success(copy.successMessage);
  }

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirm}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      tone={copy.tone}
    />
  );
}
