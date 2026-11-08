"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";

const FALLBACK_MESSAGE = "인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

/**
 * 로그인 상태나 팀원 정보를 확인하지 못했을 때 (연결 끊김, 설정 누락 등).
 * LoginFrame 왼쪽에 들어가는 내용이라 로그인·초대 안내(SignInPanel, NotInvitedPanel)와 모양이 같다.
 */
export function AuthErrorPanel() {
  const { error, retry, signOut, user } = useAuth();

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-primary">강사 팀 전용</p>
        <h1 className="text-4xl font-bold tracking-tight text-ink text-balance md:text-6xl">
          계정 정보를 확인하지 못했습니다
        </h1>
      </div>

      {/* 화면 전체가 이 안내로 바뀌므로, 화면 낭독기가 원인을 바로 읽게 한다 */}
      <p role="alert" className="max-w-prose text-lg leading-relaxed text-ink">
        {error ?? FALLBACK_MESSAGE}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="w-full sm:w-auto" onClick={retry}>
          다시 시도
        </Button>
        {user ? (
          <Button variant="outline" className="w-full sm:w-auto" onClick={signOut}>
            로그아웃
          </Button>
        ) : null}
      </div>
    </>
  );
}
