"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NoticeBell } from "@/components/notices/NoticeBell";
import { Button } from "@/components/ui/Button";
import { cn, focusRing } from "@/components/ui/cn";
import { BrandMark } from "./BrandMark";
import { NavLinks, NavList, type NavItem } from "./NavLinks";
import { pageContainerClass, PageWidthProvider, type PageWidth } from "./Page";

interface AppShellProps {
  children: ReactNode;
  /** 머리글과 PageHeader·PageBody의 기본 폭. full은 칸반 보드처럼 화면 폭을 다 쓰는 페이지 */
  width?: PageWidth;
}

/**
 * 로그인한 화면의 공통 틀: 위에 붙는 머리글(앱 이름, 메뉴, 내 이메일, 알림 종, 로그아웃) + 본문.
 * 본문은 각 화면이 PageHeader(네이비 타일)와 PageBody로 채운다.
 * RequireMember 안에서 쓴다. 관리자 화면은 이 안에 RequireAdmin을 둔다.
 */
export function AppShell({ children, width = "default" }: AppShellProps) {
  const { email, isAdmin, signOut } = useAuth();

  const items: NavItem[] = [
    { href: "/", label: "홈" },
    { href: "/calendar", label: "캘린더" },
    { href: "/fees", label: "강사료" },
    { href: "/clients", label: "고객사" },
    { href: "/archive", label: "보관함" },
    ...(isAdmin ? [{ href: "/admin", label: "관리자" }] : []),
    { href: "/guide", label: "이용 안내" },
  ];

  const container = pageContainerClass(width);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className={cn(container, "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2")}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link
              href="/"
              className={cn(
                "inline-flex min-h-11 items-center gap-2.5 rounded-button text-lg font-bold text-primary",
                focusRing,
              )}
            >
              <BrandMark />
              강의 준비 보드
            </Link>
            <nav aria-label="주 메뉴">
              <Suspense fallback={<NavList items={items} pathname={null} />}>
                <NavLinks items={items} />
              </Suspense>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {email ? (
              <span className="hidden max-w-[16rem] truncate text-sm text-muted md:inline" title={email}>
                {email}
              </span>
            ) : null}
            <NoticeBell />
            <Button variant="ghost" size="sm" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>
      <PageWidthProvider value={width}>
        <main className="flex-1 pb-12">{children}</main>
      </PageWidthProvider>
    </div>
  );
}
