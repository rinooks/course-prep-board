"use client";

// pageContainerClass가 "use client" 파일(Page.tsx)에 있어, 서버 컴포넌트에서 불러도 깨지지 않게 이 머리글도 클라이언트로 둔다

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { BrandMark } from "./BrandMark";
import { pageContainerClass } from "./Page";

/**
 * 로그인하지 않은 화면의 머리글: 앱 이름 + 오른쪽 버튼(있으면). 메뉴는 없다.
 * AppShell 머리글과 폭·높이가 같다. 로그인 화면(LoginFrame)과 이용 안내(/guide)가 같이 쓴다.
 */
export function PublicHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-md">
      <div className={cn(pageContainerClass("default"), "flex items-center justify-between gap-4 py-2")}>
        <span className="inline-flex min-h-11 items-center gap-2.5 text-lg font-bold text-primary">
          <BrandMark />
          강의 준비 보드
        </span>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
