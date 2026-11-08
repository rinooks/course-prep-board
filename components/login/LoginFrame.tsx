"use client";

// pageContainerClass가 "use client" 파일(Page.tsx)에 있어, 서버 컴포넌트에서 불러도 깨지지 않게 이 틀도 클라이언트로 둔다

import type { ReactNode } from "react";
import { pageContainerClass } from "@/components/layout/Page";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { cn } from "@/components/ui/cn";
import { LoginGuide } from "./LoginGuide";
import { StagePreview } from "./StagePreview";

/**
 * 로그인 화면의 틀 (design.md 6장 정적 히어로).
 * 위: 앱 이름 머리글(AppShell과 같은 폭·높이, 메뉴 없음) / 가운데: 왼쪽 상태별 내용(children) + 오른쪽 7단계 미리보기 / 아래: 이용 안내(#guide)
 * 로그인 화면 말고도 초대 안 됨(NotInvitedScreen)·계정 확인 오류(AuthErrorScreen) 화면이 같이 쓴다.
 */
export function LoginFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader />

      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div
            className={cn(
              pageContainerClass("default"),
              "grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]",
            )}
          >
            <div className="flex animate-pop-in flex-col gap-6 motion-reduce:animate-none">{children}</div>
            <StagePreview />
          </div>
        </section>
        <LoginGuide />
      </main>
    </div>
  );
}
