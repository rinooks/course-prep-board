"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthErrorScreen } from "@/components/auth/AuthErrorScreen";
import { NotInvitedScreen } from "@/components/auth/NotInvitedScreen";
import { LoadingBlock } from "@/components/ui/Spinner";
import { safeNextPath } from "@/lib/domain/validation";
import { LoginFrame } from "./LoginFrame";
import { SignInPanel } from "./SignInPanel";

/**
 * /login 화면. 로그인 상태에 따라 보여줄 것을 고른다.
 * - 팀원: 원래 가려던 화면(next)이나 홈으로 이동
 * - 초대 안 됨: 초대 요청 안내 + 로그아웃
 * - 연결·설정 오류: 다시 시도 화면
 * - 그 밖: 로그인 버튼 (확인 중에는 버튼을 잠근다)
 * useSearchParams를 쓰므로 app/login/page.tsx가 Suspense로 감싼다.
 */
export function LoginScreen() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 외부 주소나 //로 시작하는 값은 막고 홈으로 보낸다
  const nextPath = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (status === "member") router.replace(nextPath);
  }, [status, nextPath, router]);

  if (status === "member") {
    return <LoadingBlock fullScreen label="들어가는 중입니다…" />;
  }
  if (status === "error") {
    return <AuthErrorScreen />;
  }
  if (status === "notInvited") {
    return <NotInvitedScreen />;
  }
  return (
    <LoginFrame>
      <SignInPanel checking={status === "loading"} />
    </LoginFrame>
  );
}
