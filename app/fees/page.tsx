import { Suspense } from "react";
import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { FeesScreen } from "@/components/fees/FeesScreen";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "강사료 · 강의 준비 보드",
};

// 강사료: 내가 볼 수 있는 모든 과정의 강사료와 입금 여부. 데이터는 브라우저에서 Firestore를 직접 구독한다.
// 화면이 주소의 ?status=·?scope= 값을 읽으므로 Suspense로 감싼다 (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).
// 다른 화면(알림 등)은 /fees?status=overdue 로 미입금만 열 수 있다.
export default function Page() {
  return (
    <RequireMember>
      <AppShell>
        <Suspense fallback={<LoadingBlock label="강사료를 여는 중입니다…" />}>
          <FeesScreen />
        </Suspense>
      </AppShell>
    </RequireMember>
  );
}
