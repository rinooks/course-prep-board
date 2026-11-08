import { ProgressBar as Bar } from "@/components/ui/ProgressBar";
import { cn } from "@/components/ui/cn";

interface ProgressBarProps {
  done: number;
  total: number;
  /** 0~100 */
  percent: number;
  /** 화면 낭독기에 읽어 줄 이름 */
  label: string;
  className?: string;
}

/** 과정 카드의 "진행률  3 / 24 카드 · 12%" + 막대 */
export function ProgressBar({ done, total, percent, label, className }: ProgressBarProps) {
  const safePercent = Math.min(100, Math.max(0, percent));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">진행률</span>
        <span className="font-semibold whitespace-nowrap text-ink tabular-nums">
          {done} / {total} 카드 · {safePercent}%
        </span>
      </div>
      <Bar percent={safePercent} label={label} valueText={`카드 ${total}장 중 ${done}장 끝남`} />
    </div>
  );
}
