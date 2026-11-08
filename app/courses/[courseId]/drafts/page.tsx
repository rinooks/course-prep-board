// /courses/[courseId]/drafts — AI 초안.
// 주소의 과정 id를 읽는 화면을 Suspense로 감싼다 (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).

import { Suspense } from "react";
import type { Metadata } from "next";
import { DraftsScreen } from "@/components/drafts/DraftsScreen";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "초안 · 강의 준비 보드",
};

export default function DraftsPage() {
  return (
    <Suspense fallback={<LoadingBlock fullScreen label="초안 화면을 여는 중입니다…" />}>
      <DraftsScreen />
    </Suspense>
  );
}
