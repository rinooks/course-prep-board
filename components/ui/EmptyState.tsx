import type { ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** 다음 할 일 버튼 (예: 새 과정 만들기) */
  action?: ReactNode;
  /** sm: 칸반 칸·회차 목록처럼 작은 구역 안 / md: 화면이나 큰 구역 전체 */
  size?: "sm" | "md";
  className?: string;
}

/** 목록이 비었을 때: 무엇이 없는지 + 무엇을 하면 되는지 */
export function EmptyState({ title, description, action, size = "md", className }: EmptyStateProps) {
  const small = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center border border-dashed border-line bg-white text-center",
        small ? "gap-1 rounded-card px-4 py-5" : "gap-3 rounded-tile px-6 py-12",
        className,
      )}
    >
      <p className={cn("font-semibold text-ink", small ? "text-sm" : "text-base")}>{title}</p>
      {description ? <p className="max-w-prose text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
