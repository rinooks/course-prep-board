// /courses/[courseId]/outputs/[outputId]/print — 결과물을 PDF로 저장하는 인쇄 화면.
// 주소의 id는 접속할 때만 알 수 있어서, 그 값을 읽는 화면을 Suspense로 감싼다
// (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).

import { Suspense } from "react";
import type { Metadata } from "next";
import { OutputPrintScreen } from "@/components/outputs/OutputPrintScreen";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "PDF로 저장 · 강의 준비 보드",
};

export default function OutputPrintPage() {
  return (
    <Suspense fallback={<LoadingBlock fullScreen label="인쇄 화면을 여는 중입니다…" />}>
      <OutputPrintScreen />
    </Suspense>
  );
}
