"use client";

// 탭 (design.md 4장 "부품 규칙"): 같은 화면 안에서 내용 묶음을 바꾼다 (보관함 / 휴지통).
// 좌우 화살표·Home·End로 옮겨 다닐 수 있다 (WAI-ARIA 탭 패턴).
// 다른 화면으로 가는 탭 모양 메뉴는 TabLinks를 쓴다.

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { cn, focusRing, focusRingInverse } from "./cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** 탭 옆 개수. 아직 모르면 null */
  count?: number | null;
}

export function tabId(group: string, id: string): string {
  return `${group}-tab-${id}`;
}

export function tabPanelId(group: string, id: string): string {
  return `${group}-panel-${id}`;
}

// 탭 줄 아래 회색 선. 테두리(border-b) 대신 안쪽 그림자로 그린다: 테두리에 탭 밑줄을 겹치려고 -mb-px를 주면
// 가로 스크롤 상자가 세로로 1px 넘쳐 쓸데없는 스크롤 화살표가 생긴다. 안쪽 그림자 위에는 탭 밑줄이 그대로 덮인다.
const TAB_LINE = "shadow-[inset_0_-1px_0_var(--color-line)]";

const TAB_BASE =
  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition motion-reduce:transition-none";

function TabCount({ count, selected }: { count: number; selected: boolean }) {
  return (
    <span
      className={cn(
        "rounded-button px-1.5 py-0.5 text-xs tabular-nums",
        selected ? "bg-primary/10 text-primary" : "bg-ink/5 text-muted",
      )}
    >
      {count}
    </span>
  );
}

interface TabsProps<T extends string> {
  /** id 앞에 붙는 이름 (한 화면에 탭이 둘이면 서로 달라야 한다) */
  group: string;
  tabs: readonly TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** 화면 낭독기가 읽는 탭 묶음 이름 */
  label: string;
}

export function Tabs<T extends string>({ group, tabs, selected, onSelect, label }: TabsProps<T>) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    onSelect(next.id);
    document.getElementById(tabId(group, next.id))?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto", TAB_LINE)}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            id={tabId(group, tab.id)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={tabPanelId(group, tab.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              TAB_BASE,
              "rounded-t-button",
              focusRing,
              isSelected ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null ? <TabCount count={tab.count} selected={isSelected} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabLinkItem {
  href: string;
  label: string;
  /** 지금 화면이면 true */
  current: boolean;
}

interface TabLinksProps {
  label: string;
  items: readonly TabLinkItem[];
  /** inverse: 네이비 타일 맨 아래에 붙는 탭 (과정 화면의 보드·재료함·초안·결과물) */
  tone?: "default" | "inverse";
}

/** 탭 모양의 메뉴 (다른 주소로 이동). 지금 화면은 aria-current="page" */
export function TabLinks({ label, items, tone = "default" }: TabLinksProps) {
  const inverse = tone === "inverse";
  return (
    <nav aria-label={label}>
      {/* 네이비 타일 안에서는 스크롤 막대가 둥근 모서리와 겹쳐 보이므로 숨긴다. 옆으로 미는 것은 그대로 된다 */}
      <ul className={cn("relative flex gap-1 overflow-x-auto", inverse ? "[scrollbar-width:none]" : TAB_LINE)}>
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                TAB_BASE,
                "rounded-t-button",
                inverse ? focusRingInverse : focusRing,
                inverse
                  ? item.current
                    ? "border-primary-foreground text-primary-foreground"
                    : "border-transparent text-primary-foreground/80 hover:text-primary-foreground"
                  : item.current
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
