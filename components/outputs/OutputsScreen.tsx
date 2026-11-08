"use client";

// /courses/[courseId]/outputs — 결과물 탭 (PRD F7).
// 주소에서 과정 id를 읽어(CourseRoute) 과정 확인·네이비 타일(CoursePageFrame) 안에 결과물 목록을 띄운다.

import { CoursePageFrame } from "@/components/course/CoursePageFrame";
import { CourseRoute } from "@/components/course/CourseRoute";
import { OutputsBody } from "./OutputsBody";

export function OutputsScreen() {
  return (
    <CourseRoute>
      {(courseId) => (
        <CoursePageFrame
          courseId={courseId}
          tab="outputs"
          description="확정한 초안이 판 번호와 함께 쌓입니다. PPT·PDF로 내려받고, 다듬은 최종본은 링크로 남깁니다."
        >
          {(course) => <OutputsBody course={course} />}
        </CoursePageFrame>
      )}
    </CourseRoute>
  );
}
