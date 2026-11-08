"use client";

// 과정 화면의 탭 메뉴 (네이비 타일 맨 아래): 보드 · 재료함 · 초안 · 결과물 · 강사료.
// 탭마다 주소가 따로 있어, 주소를 동료에게 보내면 같은 탭이 열린다.

import { TabLinks } from "@/components/ui/Tabs";

export type CourseTab = "board" | "materials" | "drafts" | "outputs" | "fees";

export const COURSE_TAB_LABELS: Record<CourseTab, string> = {
  board: "보드",
  materials: "재료함",
  drafts: "초안",
  outputs: "결과물",
  fees: "강사료",
};

const ORDER: readonly CourseTab[] = ["board", "materials", "drafts", "outputs", "fees"];

/** 탭 주소. 보드는 과정 주소 그대로다 */
export function courseTabHref(courseId: string, tab: CourseTab): string {
  const base = `/courses/${encodeURIComponent(courseId)}`;
  return tab === "board" ? base : `${base}/${tab}`;
}

export function CourseTabs({ courseId, current }: { courseId: string; current: CourseTab }) {
  return (
    <TabLinks
      label="과정 메뉴"
      tone="inverse"
      items={ORDER.map((tab) => ({
        href: courseTabHref(courseId, tab),
        label: COURSE_TAB_LABELS[tab],
        current: tab === current,
      }))}
    />
  );
}
