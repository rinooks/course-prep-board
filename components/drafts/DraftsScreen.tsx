"use client";

// /courses/[courseId]/drafts — AI 초안 (PRD F6)

import { CoursePageFrame } from "@/components/course/CoursePageFrame";
import { CourseRoute } from "@/components/course/CourseRoute";
import { DraftsBody } from "./DraftsBody";

export function DraftsScreen() {
  return (
    <CourseRoute>
      {(courseId) => (
        <CoursePageFrame
          courseId={courseId}
          tab="drafts"
          description="재료를 골라 AI에 붙여 넣을 요청문을 만들고, AI가 준 답을 초안으로 저장해 다듬은 뒤 확정합니다."
        >
          {(course) => <DraftsBody course={course} />}
        </CoursePageFrame>
      )}
    </CourseRoute>
  );
}
