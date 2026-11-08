import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import type { HomeScope } from "./homeOverview";

const OPTIONS: readonly SegmentOption<HomeScope>[] = [
  { value: "team", label: "팀 전체" },
  { value: "mine", label: "내 것만" },
];

interface HomeScopeToggleProps {
  scope: HomeScope;
  onChange: (scope: HomeScope) => void;
}

/** 홈 네이비 타일 안의 "팀 전체 / 내 것만" 전환. 고른 쪽이 흰 버튼이다. */
export function HomeScopeToggle({ scope, onChange }: HomeScopeToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl tone="inverse" label="보기 범위" options={OPTIONS} value={scope} onChange={onChange} />
      <p className="text-sm text-primary-foreground/80">
        {scope === "mine"
          ? "내가 담당 강사인 과정과 나에게 맡긴 카드만 보입니다."
          : "팀의 모든 진행 중인 과정이 보입니다."}
      </p>
    </div>
  );
}
