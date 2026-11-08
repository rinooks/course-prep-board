"use client";

// /courses/[courseId]/materials — 재료함 (PRD F4·F5)

import { CoursePageFrame } from "@/components/course/CoursePageFrame";
import { CourseRoute } from "@/components/course/CourseRoute";
import { MaterialsBody } from "./MaterialsBody";

export function MaterialsScreen() {
  return (
    <CourseRoute>
      {(courseId) => (
        <CoursePageFrame
          courseId={courseId}
          tab="materials"
          description="과정 준비에 쓰는 회의 기록, 받아쓰기, 참고 링크를 한곳에 모읍니다."
        >
          {(course) => <MaterialsBody course={course} />}
        </CoursePageFrame>
      )}
    </CourseRoute>
  );
}
