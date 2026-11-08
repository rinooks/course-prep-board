// 강사료 요약 3칸: 미입금 · 받을 예정 · 입금됨 (건수와 금액 합계).
// 과정 탭과 강사료 화면이 같이 쓴다. 칸 이름에 상태를 적어 색만으로 구분하지 않는다.

import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { DateString } from "@/lib/domain/dates";
import { FEE_STATUS_LABELS, formatWon, summarizeFees, type FeeLike, type FeeStatus } from "@/lib/domain/fees";

interface Tile {
  status: FeeStatus;
  hint: string;
}

const TILES: readonly Tile[] = [
  { status: "overdue", hint: "예정일이 지났는데 입금 전" },
  { status: "upcoming", hint: "입금 예정일 전" },
  { status: "paid", hint: "입금을 확인한 것" },
];

/** 금액 글자 색: 미입금이 있으면 빨강, 입금됨은 초록, 나머지는 네이비 */
function amountClass(status: FeeStatus, count: number): string {
  if (status === "overdue" && count > 0) return "text-danger";
  if (status === "paid" && count > 0) return "text-success";
  return "text-primary";
}

interface FeeSummaryTilesProps {
  fees: readonly FeeLike[];
  today: DateString;
}

export function FeeSummaryTiles({ fees, today }: FeeSummaryTilesProps) {
  const summary = summarizeFees(fees, today);

  return (
    <ul aria-label="강사료 요약" className="grid gap-4 md:grid-cols-3">
      {TILES.map((tile) => {
        const totals = summary[tile.status];
        return (
          <li key={tile.status}>
            <Card className="flex h-full flex-col gap-1">
              <span className="text-sm font-semibold text-muted">{FEE_STATUS_LABELS[tile.status]}</span>
              <span
                className={cn(
                  "text-3xl font-bold tracking-tight tabular-nums",
                  amountClass(tile.status, totals.count),
                )}
              >
                {formatWon(totals.amount)}
              </span>
              <span className="text-sm text-muted">
                {totals.count}건 · {tile.hint}
              </span>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
