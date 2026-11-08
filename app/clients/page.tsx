import { Suspense } from "react";
import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { ClientsScreen } from "@/components/clients/ClientsScreen";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "고객사 · 강의 준비 보드",
};

// 고객사 주소록: 고객사와 담당자 연락처. 데이터는 브라우저에서 Firestore를 직접 구독한다.
// 화면이 주소의 ?new=, ?client= 값을 읽으므로 Suspense로 감싼다 (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).
export default function Page() {
  return (
    <RequireMember>
      <AppShell>
        <Suspense fallback={<LoadingBlock label="주소록을 여는 중입니다…" />}>
          <ClientsScreen />
        </Suspense>
      </AppShell>
    </RequireMember>
  );
}
