"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useAuth } from "./AuthProvider";
import { AuthErrorScreen } from "./AuthErrorScreen";
import { NotInvitedScreen } from "./NotInvitedScreen";

/** 로그인 화면 주소. 돌아올 경로를 next로 붙인다. */
export function loginPath(next?: string): string {
  if (!next || next === "/") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * 초대받은 팀원만 children을 보여준다.
 * - 확인 중: 스피너
 * - 로그인 안 함: /login?next=지금경로 로 이동
 * - 초대 안 됨: "초대가 필요합니다" 화면
 * - 오류: 다시 시도 화면
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status !== "signedOut") return;
    // usePathname은 동적 주소에서 Suspense가 필요해, 이동 직전에 브라우저 주소를 직접 읽는다
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(loginPath(here));
  }, [status, router]);

  if (status === "member") return <>{children}</>;
  if (status === "notInvited") return <NotInvitedScreen />;
  if (status === "error") return <AuthErrorScreen />;
  if (status === "signedOut") return <LoadingBlock fullScreen label="로그인 화면으로 이동하는 중입니다…" />;
  return <LoadingBlock fullScreen label="계정을 확인하는 중입니다…" />;
}
