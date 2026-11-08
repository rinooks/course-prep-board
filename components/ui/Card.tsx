import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** true면 마우스를 올렸을 때 살짝 떠오른다 (눌러서 이동하는 카드) */
  interactive?: boolean;
  /**
   * 안쪽 여백 (design.md 4장 "부품 규칙").
   * - md(기본): 앱 화면의 카드·패널. 휴대폰 p-4, 넓은 화면 p-5
   * - sm: 카드 안에 들어가는 작은 상자 (회차 한 칸 등)
   * - lg: 로그인·안내 화면처럼 여유 있는 카드
   * - none: 안쪽을 직접 나누는 상자 (달력, 목록)
   */
  padding?: "none" | "sm" | "md" | "lg";
  /** true면 그림자 없이 테두리만, 모서리도 작게(6px). 타일 안에 들어가는 상자에 쓴다 (그림자가 겹치지 않게) */
  flat?: boolean;
  /** surface: 회색 바탕 (지난 회차처럼 한 단계 물러난 상자) */
  tone?: "white" | "surface";
  children: ReactNode;
}

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-6",
} as const;

/** 타일 겉모양. <section>처럼 Card가 아닌 요소를 타일로 만들 때 쓴다 (Section의 tile) */
export const tileClass = "rounded-tile border border-line bg-white p-4 shadow-card md:p-5";

/** design.md 4장 "타일 · 보더형". 벤토 타일처럼 생긴 상자는 직접 만들지 말고 이것을 쓴다. */
export function Card({
  interactive = false,
  padding = "md",
  flat = false,
  tone = "white",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "border border-line",
        flat ? "rounded-card" : "rounded-tile",
        tone === "white" ? "bg-white" : "bg-surface",
        !flat && "shadow-card",
        PADDING[padding],
        interactive &&
          "transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
