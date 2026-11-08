"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ButtonLink } from "@/components/ui/Button";

/**
 * 이용 안내 화면의 틀. 로그인 없이도 볼 수 있어 RequireMember로 감싸지 않는다.
 * - 팀원: 다른 화면과 같은 머리글(메뉴·알림·로그아웃)
 * - 그 밖: 앱 이름 머리글 + 로그인 화면으로 가는 버튼.
 *   로그인 상태를 확인하는 동안에는 버튼을 숨긴다 (팀원인데 잠깐 "로그인" 버튼이 보이지 않게)
 */
export function GuideShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "member") {
    return <AppShell>{children}</AppShell>;
  }

  // 초대 안 됨·오류일 때도 /login이 그 상태에 맞는 안내를 보여준다
  const loginButton =
    status === "loading" ? null : (
      <ButtonLink href="/login" size="sm">
        {status === "signedOut" ? "로그인" : "로그인 화면으로"}
      </ButtonLink>
    );

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader actions={loginButton} />
      <main className="flex-1 pb-12">{children}</main>
    </div>
  );
}
