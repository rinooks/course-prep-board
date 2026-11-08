"use client";

import { Button } from "./Button";
import { cn } from "./cn";

// 보기 방식 고르기 (팀 전체 / 내 것만, 달 / 주 …). design.md 4장 "부품 규칙"의 고르기 컨트롤.
// - 화면 안에서 내용 묶음을 바꾸는 것(보관함 / 휴지통)은 Tabs를 쓴다
// - 다른 화면으로 가는 것은 링크(메뉴, 과정 탭)를 쓴다

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** 화면 낭독기가 읽는 묶음 이름 (예: "보기 범위") */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** inverse: 네이비 타일 위 / default: 흰 바탕 위 */
  tone?: "inverse" | "default";
  className?: string;
}

/** 고른 쪽이 채워진 버튼, 나머지는 테두리 버튼이다 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "default",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        const variant =
          tone === "inverse" ? (selected ? "inverse" : "inverseOutline") : selected ? "solid" : "outline";
        return (
          <Button
            key={option.value}
            size="sm"
            variant={variant}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
