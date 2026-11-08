"use client";

// /courses/[courseId]/fees — 과정의 강사료 탭 (받을 금액·입금 예정일·입금 확인)

import { CoursePageFrame } from "@/components/course/CoursePageFrame";
import { CourseRoute } from "@/components/course/CourseRoute";
import { CourseFeesBody } from "./CourseFeesBody";

export function CourseFeesScreen() {
  return (
    <CourseRoute>
      {(courseId) => (
        <CoursePageFrame
          courseId={courseId}
          tab="fees"
          description="이 과정에서 받을 강사료와 입금 여부를 적어 둡니다. 예정일이 지나면 미입금으로 표시됩니다."
        >
          {(course) => <CourseFeesBody course={course} />}
        </CoursePageFrame>
      )}
    </CourseRoute>
  );
}
