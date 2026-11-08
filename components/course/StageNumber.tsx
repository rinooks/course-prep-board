import { cn } from "@/components/ui/cn";

interface StageNumberProps {
  order: number;
  /** inverse: 네이비 바탕 위(흰 칸에 네이비 숫자) */
  tone?: "default" | "inverse";
  className?: string;
}

/**
 * 단계 번호 칸 (1~7). 칸반 칸 머리·단계 바로가기·로그인 미리보기가 같이 쓴다.
 * 화면 낭독기에는 "1단계"로 읽힌다 (숫자만 읽히면 무슨 뜻인지 알기 어렵다).
 */
export function StageNumber({ order, tone = "default", className }: StageNumberProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-6 shrink-0 items-center justify-center rounded-button text-xs font-bold tabular-nums",
        tone === "inverse" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        className,
      )}
    >
      <span aria-hidden="true">{order}</span>
      <span className="sr-only">{order}단계 </span>
    </span>
  );
}
