import type { Metadata } from "next";
import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { RequireMember } from "@/components/auth/RequireMember";
import { AppShell } from "@/components/layout/AppShell";
import { TeamAdminScreen } from "@/components/admin/TeamAdminScreen";

export const metadata: Metadata = {
  title: "팀 관리 · 강의 준비 보드",
};

// 관리자 확인(RequireAdmin)을 머리글(AppShell) 안쪽에 두어, 관리자가 아닐 때도 머리글과 네이비 타일가 보이게 한다
export default function AdminPage() {
  return (
    <RequireMember>
      <AppShell>
        <RequireAdmin>
          <TeamAdminScreen />
        </RequireAdmin>
      </AppShell>
    </RequireMember>
  );
}
