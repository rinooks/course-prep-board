import { cn } from "@/components/ui/cn";
import type { CourseProgress } from "@/lib/domain/progress";

interface StageTrackProps {
  progress: CourseProgress;
  /** inverse: 네이비 타일 위에 놓을 때 (흰색 막대) */
  tone?: "default" | "inverse";
  className?: string;
}

const COLORS = {
  default: { complete: "bg-primary", current: "bg-primary/50", todo: "bg-line" },
  inverse: {
    complete: "bg-primary-foreground",
    current: "bg-primary-foreground/50",
    todo: "bg-primary-foreground/15",
  },
} as const;

/** 7단계 막대. 끝난 단계는 진하게, 지금 단계는 중간, 남은 단계는 옅게 칠한다. */
export function StageTrack({ progress, tone = "default", className }: StageTrackProps) {
  const colors = COLORS[tone];
  const completeCount = progress.stages.filter((stage) => stage.complete).length;
  const currentLabel = progress.stages.find((stage) => stage.stageId === progress.currentStageId)?.label;
  const summary = progress.allDone
    ? "7단계 모두 끝남"
    : `7단계 중 ${completeCount}단계 끝남${currentLabel ? `, 지금 ${currentLabel} 단계` : ""}`;

  return (
    <div role="img" aria-label={summary} className={cn("flex gap-1", className)}>
      {progress.stages.map((stage) => (
        <span
          key={stage.stageId}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            stage.complete
              ? colors.complete
              : stage.stageId === progress.currentStageId
                ? colors.current
                : colors.todo,
          )}
        />
      ))}
    </div>
  );
}
