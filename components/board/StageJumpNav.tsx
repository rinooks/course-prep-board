"use client";

// 칸반 위 "단계 바로가기": 7단계 버튼을 누르면 칸반의 그 칸으로 옮겨 간다.
// 칸반은 화면보다 넓어 옆으로 밀어야 하는데, 휴대폰에서는 7번째 칸까지 여러 번 밀어야 해서 만들었다.

import { StageNumber } from "@/components/course/StageNumber";
import { cn, focusRing } from "@/components/ui/cn";
import { handleJumpClick } from "@/components/ui/jumpTo";
import type { CourseProgress } from "@/lib/domain/progress";
import { STAGES, type StageId } from "@/lib/domain/stages";
import { CheckIcon } from "@/components/ui/icons";

/** 칸반 칸(KanbanColumn)의 id */
export function stageColumnId(stageId: StageId): string {
  return `stage-${stageId}`;
}

interface StageJumpNavProps {
  progress: CourseProgress;
}

export function StageJumpNav({ progress }: StageJumpNavProps) {
  return (
    <nav aria-label="단계 바로가기">
      {/* 휴대폰은 한 줄로 옆으로 밀고, 넓은 화면은 줄을 바꿔 다 보인다. relative: 숨은 글자가 스크롤 상자를 빠져나가지 않게 */}
      <ol className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {STAGES.map((stage, index) => {
          const stageProgress = progress.stages[index];
          const current = stage.id === progress.currentStageId;
          const complete = stageProgress?.complete ?? false;
          const targetId = stageColumnId(stage.id);
          return (
            <li key={stage.id} className="shrink-0">
              <a
                href={`#${targetId}`}
                onClick={(event) => handleJumpClick(event, targetId)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-button border px-3 text-sm font-semibold whitespace-nowrap transition motion-reduce:transition-none",
                  current
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    : complete
                      ? "border-success/25 bg-success/5 text-success hover:bg-success/10"
                      : "border-line bg-white text-ink hover:bg-ink/5",
                  focusRing,
                )}
              >
                {/* 지금 단계 칸은 네이비 바탕이라 번호 칸을 흰색으로 뒤집는다 */}
                <StageNumber order={stage.order} tone={current ? "inverse" : "default"} />
                {stage.label}
                {complete ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                <span className="sr-only">
                  {complete ? ", 완료" : current ? ", 지금 단계" : ""}
                  {stageProgress ? `, 카드 ${stageProgress.total}장 중 ${stageProgress.done}장 끝남` : ""}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
