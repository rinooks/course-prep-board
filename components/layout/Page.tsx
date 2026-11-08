"use client";

// 로그인 뒤 화면의 페이지 틀: 맨 위 네이비 타일(PageHeader)과 그 아래 본문(PageBody).
// 폭은 AppShell의 width를 따라가고, 필요하면 각자 width로 바꾼다.

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** default: 가운데 최대 폭 / narrow: 입력 화면용 좁은 폭 / full: 칸반처럼 화면 폭을 다 씀 */
export type PageWidth = "default" | "narrow" | "full";

const PageWidthContext = createContext<PageWidth>("default");

export const PageWidthProvider = PageWidthContext.Provider;

export function pageContainerClass(width: PageWidth): string {
  if (width === "full") return "w-full px-4 md:px-6";
  if (width === "narrow") return "mx-auto w-full max-w-3xl px-4 md:px-6";
  return "mx-auto w-full max-w-7xl px-4 md:px-6";
}

function usePageWidth(override: PageWidth | undefined): PageWidth {
  const inherited = useContext(PageWidthContext);
  return override ?? inherited;
}

interface PageHeaderTileProps {
  /** 제목 위 작은 글자 (날짜, 고객사 등) */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 오른쪽(휴대폰은 아래) 버튼. 네이비 위라 Button의 inverse·inverseOutline을 쓴다 */
  actions?: ReactNode;
  /** 제목 아래 타일 안에 넣을 내용 (요약 정보 등) */
  children?: ReactNode;
  /** 타일 맨 아래에 붙는 탭 메뉴 (과정 화면의 보드·재료함·초안·결과물). TabLinks tone="inverse" */
  tabs?: ReactNode;
  /** true면 버튼을 제목 옆이 아니라 항상 아래에 둔다. 버튼이 많은데 타일 폭이 좁을 때 쓴다 (과정 보드) */
  stacked?: boolean;
  className?: string;
}

/** 네이비 타일 자체. 다른 타일과 나란히 격자에 넣을 때 직접 쓴다 (홈). 보통은 PageHeader를 쓴다. */
export function PageHeaderTile({
  eyebrow,
  title,
  description,
  actions,
  children,
  tabs,
  stacked = false,
  className,
}: PageHeaderTileProps) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col justify-between gap-6 rounded-tile bg-primary px-5 pt-6 text-primary-foreground md:px-8 md:pt-8",
        // 탭이 있으면 탭 밑줄이 타일 아래 끝에 붙도록 아래 여백을 없앤다
        tabs ? "pb-0" : "pb-6 md:pb-8",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-4", !stacked && "md:flex-row md:items-end md:justify-between")}>
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary-foreground/80">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h1>
          {description ? (
            <div className="max-w-prose text-base leading-relaxed text-primary-foreground/80">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
      {tabs}
    </div>
  );
}

interface PageHeaderProps extends Omit<PageHeaderTileProps, "className"> {
  width?: PageWidth;
}

/** 페이지 맨 위 네이비 타일 (design.md 코퍼레이트 네이비). 제목은 흰 글자다. */
export function PageHeader({ width, ...tile }: PageHeaderProps) {
  const container = pageContainerClass(usePageWidth(width));
  return (
    <div className={cn(container, "pt-4")}>
      <PageHeaderTile {...tile} />
    </div>
  );
}

interface PageBodyProps {
  children: ReactNode;
  className?: string;
  width?: PageWidth;
}

/**
 * 네이비 타일 아래 본문 영역. 타일·구역끼리는 항상 gap-4로 띄운다 (design.md 4장 "부품 규칙").
 * 화면마다 간격을 따로 정하지 않는다.
 */
export function PageBody({ children, className, width }: PageBodyProps) {
  const container = pageContainerClass(usePageWidth(width));
  return <div className={cn(container, "flex flex-col gap-4 pt-4 pb-6 md:pb-8", className)}>{children}</div>;
}
