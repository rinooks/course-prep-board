// /courses/[courseId]/outputs — 과정의 결과물 탭 (확정한 초안, PPT·PDF 내려받기, 최종본 링크).
// 주소의 과정 id는 접속할 때만 알 수 있어서, 그 값을 읽는 화면을 Suspense로 감싼다
// (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).

import { Suspense } from "react";
import type { Metadata } from "next";
import { OutputsScreen } from "@/components/outputs/OutputsScreen";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "결과물 · 강의 준비 보드",
};

export default function CourseOutputsPage() {
  return (
    <Suspense fallback={<LoadingBlock fullScreen label="결과물 화면을 여는 중입니다…" />}>
      <OutputsScreen />
    </Suspense>
  );
}
