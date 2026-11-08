import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// 벤토 격자 (design.md 4장 "부품 규칙"). 타일을 나란히 놓을 때 화면마다 칸과 간격을 따로 정하지 않고 이것을 쓴다.
// 타일 사이 간격은 항상 gap-4(16px)이고, 휴대폰에서는 모두 한 줄로 쌓인다.

export type BentoLayout = "main-side" | "halves" | "thirds";

const LAYOUT_CLASS: Record<BentoLayout, string> = {
  // 넓은 본문 + 오른쪽 좁은 칸. 위아래 줄이 같은 세로선에 맞도록 오른쪽 폭을 고정한다
  "main-side": "lg:grid-cols-[minmax(0,1fr)_24rem]",
  halves: "md:grid-cols-2",
  // 2칸일 때 타일 수가 홀수면 마지막 타일을 넓혀 빈칸을 없앤다
  thirds: "md:grid-cols-2 xl:grid-cols-3 md:max-xl:[&>:last-child:nth-child(odd)]:col-span-2",
};

/** 좁은 타일 안의 세로 목록. 넓은 화면에서는 일정 높이를 넘으면 타일 안에서 스크롤해 아래 타일이 밀려나지 않게 한다 */
export const tileListClass = "flex flex-col gap-3 md:-mx-1 md:-my-1 md:max-h-[26rem] md:overflow-y-auto md:px-1 md:py-1 md:[scrollbar-width:thin]";

interface BentoGridProps extends HTMLAttributes<HTMLDivElement> {
  layout: BentoLayout;
  children: ReactNode;
}

/** 타일을 칸에 맞춰 놓는 격자. 같은 줄의 타일은 높이가 같아진다 (안쪽 타일에 h-full) */
export function BentoGrid({ layout, className, children, ...rest }: BentoGridProps) {
  return (
    <div className={cn("grid min-w-0 gap-4", LAYOUT_CLASS[layout], className)} {...rest}>
      {children}
    </div>
  );
}
