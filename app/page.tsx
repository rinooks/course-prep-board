import { RequireMember } from "@/components/auth/RequireMember";
import { HomeScreen } from "@/components/home/HomeScreen";
import { AppShell } from "@/components/layout/AppShell";

// 홈: 진행 중인 과정 목록과 "오늘·이번 주". 데이터는 브라우저에서 Firestore를 직접 구독한다.
export default function Page() {
  return (
    <RequireMember>
      <AppShell>
        <HomeScreen />
      </AppShell>
    </RequireMember>
  );
}
