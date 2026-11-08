"use client";

import { AuthErrorPanel } from "@/components/login/AuthErrorPanel";
import { LoginFrame } from "@/components/login/LoginFrame";

/**
 * 로그인 상태나 팀원 정보를 확인하지 못했을 때 (연결 끊김, 설정 누락 등).
 * 로그인 화면과 같은 틀(앱 이름 머리글 + 히어로)에 다시 시도·로그아웃 버튼을 보여준다. /login에서도 쓴다.
 */
export function AuthErrorScreen() {
  return (
    <LoginFrame>
      <AuthErrorPanel />
    </LoginFrame>
  );
}
