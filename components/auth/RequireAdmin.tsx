"use client";

import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "./AuthProvider";

/**
 * 관리자만 children을 보여준다. RequireMember → AppShell 안에 둔다.
 *   <RequireMember><AppShell><RequireAdmin>…</RequireAdmin></AppShell></RequireMember>
 * 관리자가 아니면 머리글은 그대로 두고, 네이비 타일에 안내 + 홈으로 가는 버튼을 보여준다.
 * isAdmin은 초대된 팀원(status "member")일 때만 true라서, 로그인 전·초대 전에는 children이 보이지 않는다.
 * 화면만 가리는 것이고, 실제 데이터 보호는 firestore.rules가 한다.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <>{children}</>;
  return (
    <>
      <PageHeader eyebrow="관리자" title="관리자만 볼 수 있는 화면입니다" />
      <PageBody>
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-prose text-base leading-relaxed text-ink">
            팀 관리가 필요하면 관리자에게 부탁하거나, 관리자로 지정해 달라고 요청하세요.
          </p>
          <ButtonLink href="/">홈으로 가기</ButtonLink>
        </div>
      </PageBody>
    </>
  );
}
