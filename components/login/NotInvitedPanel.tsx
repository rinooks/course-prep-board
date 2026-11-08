"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

/**
 * 구글 로그인은 했지만 팀에 초대되지 않은 계정.
 * 내 팀원 문서를 실시간으로 보고 있어서, 관리자가 초대하면 새로고침 없이 바로 들어가진다.
 */
export function NotInvitedPanel() {
  const { email, signOut, error } = useAuth();

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-primary">강사 팀 전용</p>
        <h1 className="text-4xl font-bold tracking-tight text-ink text-balance md:text-6xl">
          아직 초대되지 않은 계정입니다
        </h1>
      </div>

      <p className="max-w-prose text-lg leading-relaxed text-ink">
        관리자에게 이 이메일(
        <span className="break-anywhere font-semibold">{email ?? "지금 로그인한 구글 계정"}</span>)로 초대를
        요청하세요.
      </p>
      <p className="max-w-prose text-sm leading-relaxed text-muted">
        초대되면 새로고침하지 않아도 이 화면이 저절로 바뀝니다. 다른 구글 계정으로 들어가려면 로그아웃한 뒤 다시
        로그인하세요.
      </p>

      {error ? <Alert tone="error" className="max-w-prose">{error}</Alert> : null}

      <Button variant="outline" className="w-full sm:w-auto sm:self-start" onClick={signOut}>
        로그아웃하고 다른 계정으로 로그인
      </Button>
    </>
  );
}
