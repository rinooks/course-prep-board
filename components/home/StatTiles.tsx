import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { handleJumpClick } from "@/components/ui/jumpTo";
import type { HomeScope } from "./homeOverview";

/** 요약 칸을 눌렀을 때 옮겨 갈 곳 (HomeScreen·WeekPanel의 id) */
export const HOME_SECTION_IDS = {
  courses: "home-courses",
  sessions: "home-week-sessions",
  dueCards: "home-week-due",
} as const;

interface StatTilesProps {
  scope: HomeScope;
  courseCount: number;
  weekSessionCount: number;
  dueCardCount: number;
  /** null이면 아직 진행률을 받지 못했다 */
  averagePercent: number | null;
}

interface Tile {
  label: string;
  value: string;
  unit: string;
  hint?: string;
  alert?: boolean;
  targetId: string;
}

/** 홈 맨 위 요약 숫자 4칸. 누르면 해당 목록으로 내려간다. */
export function StatTiles({ scope, courseCount, weekSessionCount, dueCardCount, averagePercent }: StatTilesProps) {
  const mine = scope === "mine";
  const tiles: Tile[] = [
    {
      label: mine ? "내가 맡은 과정" : "진행 중인 과정",
      value: `${courseCount}`,
      unit: "개",
      targetId: HOME_SECTION_IDS.courses,
    },
    {
      label: mine ? "내 이번 주 강의" : "이번 주 강의",
      value: `${weekSessionCount}`,
      unit: "회",
      hint: "오늘부터 7일",
      targetId: HOME_SECTION_IDS.sessions,
    },
    {
      label: mine ? "나에게 온 마감 임박 카드" : "마감 임박 카드",
      value: `${dueCardCount}`,
      unit: "장",
      hint: "지났거나 7일 안",
      alert: dueCardCount > 0,
      targetId: HOME_SECTION_IDS.dueCards,
    },
    {
      label: "평균 진행률",
      value: averagePercent === null ? "–" : `${averagePercent}`,
      unit: averagePercent === null ? "" : "%",
      hint: mine ? "내가 맡은 과정 기준" : undefined,
      targetId: HOME_SECTION_IDS.courses,
    },
  ];

  return (
    <ul aria-label="요약" className="grid grid-cols-2 gap-4">
      {tiles.map((tile) => (
        <li key={tile.targetId + tile.label}>
          <a
            href={`#${tile.targetId}`}
            onClick={(event) => handleJumpClick(event, tile.targetId)}
            className={cn("group block h-full rounded-tile", focusRing)}
          >
            <Card interactive className="flex h-full flex-col gap-1">
              <span className="text-sm font-semibold text-muted group-hover:text-primary">{tile.label}</span>
              <span className="flex items-baseline gap-1">
                <span
                  className={
                    tile.alert
                      ? "text-3xl font-bold tracking-tight text-danger tabular-nums"
                      : "text-3xl font-bold tracking-tight text-primary tabular-nums"
                  }
                >
                  {tile.value}
                </span>
                {tile.unit ? <span className="text-base font-semibold text-muted">{tile.unit}</span> : null}
              </span>
              {tile.hint ? <span className="text-sm text-muted">{tile.hint}</span> : null}
            </Card>
          </a>
        </li>
      ))}
    </ul>
  );
}
