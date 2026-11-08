// /courses/[courseId]/materials — 재료함.
// 주소의 과정 id는 접속할 때만 알 수 있어서, 그 값을 읽는 화면을 Suspense로 감싼다
// (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).

import { Suspense } from "react";
import type { Metadata } from "next";
import { MaterialsScreen } from "@/components/materials/MaterialsScreen";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "재료함 · 강의 준비 보드",
};

export default function MaterialsPage() {
  return (
    <Suspense fallback={<LoadingBlock fullScreen label="재료함을 여는 중입니다…" />}>
      <MaterialsScreen />
    </Suspense>
  );
}
