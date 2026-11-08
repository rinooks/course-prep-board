// 과정 구분 색의 클래스 이름. Tailwind가 찾을 수 있게 클래스를 글자 그대로 적어 둔다 (조립하지 않는다).

import { courseColorIndex } from "@/lib/domain/courseColor";

export interface CourseColorClasses {
  /** 바탕 (흰 글자를 올려도 읽힌다) */
  bg: string;
  /** 왼쪽 굵은 선 */
  borderLeft: string;
  /** 글자 */
  text: string;
}

const COLORS: readonly CourseColorClasses[] = [
  { bg: "bg-course-1", borderLeft: "border-l-course-1", text: "text-course-1" },
  { bg: "bg-course-2", borderLeft: "border-l-course-2", text: "text-course-2" },
  { bg: "bg-course-3", borderLeft: "border-l-course-3", text: "text-course-3" },
  { bg: "bg-course-4", borderLeft: "border-l-course-4", text: "text-course-4" },
  { bg: "bg-course-5", borderLeft: "border-l-course-5", text: "text-course-5" },
  { bg: "bg-course-6", borderLeft: "border-l-course-6", text: "text-course-6" },
];

export function courseColor(courseId: string): CourseColorClasses {
  return COLORS[courseColorIndex(courseId)];
}
