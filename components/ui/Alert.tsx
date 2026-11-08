import type { ReactNode } from "react";
import { cn } from "./cn";

export type AlertTone = "error" | "warning" | "info" | "success";

const TONES: Record<AlertTone, string> = {
  error: "border-danger/25 bg-danger/5 text-danger",
  warning: "border-warning/25 bg-warning/5 text-warning",
  info: "border-primary/20 bg-primary/5 text-ink",
  success: "border-success/25 bg-success/5 text-success",
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  /** 오른쪽(모바일은 아래)에 놓을 버튼. 예: 다시 시도 */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** 칸 안 안내 상자. error는 화면 낭독기가 바로 읽는다(role=alert). */
export function Alert({ tone = "info", title, action, className, children }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-card border p-4 text-sm md:flex-row md:items-center md:justify-between",
        TONES[tone],
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
