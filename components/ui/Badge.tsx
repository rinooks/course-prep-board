import type { ReactNode } from "react";
import { cn } from "./cn";

/** inverse·inverseStrong은 네이비 타일(PageHeader) 위에 놓는 배지다. inverseStrong은 흰 바탕이라 더 눈에 띈다 */
export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "inverse" | "inverseStrong";

// 상태 색은 design.md 2장의 danger·success·warning 토큰을 쓴다
const TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface text-muted",
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  inverse: "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground",
  inverseStrong: "border-primary-foreground bg-primary-foreground text-primary",
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-button border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
