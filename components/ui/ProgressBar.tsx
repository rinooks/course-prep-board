import { cn } from "./cn";

interface ProgressBarProps {
  /** 0~100 */
  percent: number;
  /** 화면 낭독기에 읽어 줄 이름 (예: "A사 과정 진행률") */
  label: string;
  /** 화면 낭독기에 읽어 줄 값 문장 (예: "카드 24장 중 3장 끝남") */
  valueText?: string;
  /** inverse: 네이비 타일 위 (흰 막대) */
  tone?: "default" | "inverse";
  className?: string;
}

/** 진행 막대. 앱의 진행 막대는 모두 이 모양이다 (높이 8px, 둥근 끝) */
export function ProgressBar({ percent, label, valueText, tone = "default", className }: ProgressBarProps) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  const inverse = tone === "inverse";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safePercent}
      aria-valuetext={valueText ? `${valueText} (${safePercent}%)` : undefined}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full",
        inverse ? "bg-primary-foreground/15" : "bg-line",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] motion-reduce:transition-none",
          inverse ? "bg-primary-foreground" : "bg-primary",
        )}
        style={{ width: `${safePercent}%` }}
      />
    </div>
  );
}
