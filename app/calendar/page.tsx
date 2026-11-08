import { Suspense } from "react";
import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "팀 캘린더 · 강의 준비 보드",
};

// 팀 캘린더: 진행 중인 과정의 강의 회차와 카드 마감일. 데이터는 브라우저에서 Firestore를 직접 구독한다.
// 화면이 주소의 ?course= 값을 읽으므로 Suspense로 감싼다 (cacheComponents 규칙: 감싸지 않으면 빌드가 실패한다).
export default function Page() {
  return (
    <RequireMember>
      <AppShell>
        <Suspense fallback={<LoadingBlock label="캘린더를 여는 중입니다…" />}>
          <CalendarScreen />
        </Suspense>
      </AppShell>
    </RequireMember>
  );
}
