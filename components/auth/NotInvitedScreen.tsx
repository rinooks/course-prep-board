"use client";

import { LoginFrame } from "@/components/login/LoginFrame";
import { NotInvitedPanel } from "@/components/login/NotInvitedPanel";

/**
 * 로그인은 했지만 초대받지 않은 계정에 보여주는 화면.
 * /login과 똑같은 틀과 안내를 쓴다 (어느 주소로 들어와도 같은 모양). /login에서도 쓴다.
 */
export function NotInvitedScreen() {
  return (
    <LoginFrame>
      <NotInvitedPanel />
    </LoginFrame>
  );
}
