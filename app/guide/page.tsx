import type { Metadata } from "next";
import { GuideScreen } from "@/components/guide/GuideScreen";
import { GuideShell } from "@/components/guide/GuideShell";

export const metadata: Metadata = {
  title: "이용 안내 · 강의 준비 보드",
  description: "강의 준비 보드가 어떤 앱인지, 무엇을 할 수 있는지 소개합니다.",
};

// 이용 안내: 로그인 없이 누구나 볼 수 있다. 데이터를 읽지 않는 고정 화면이다.
// 팀원이면 평소 머리글(메뉴·알림)을, 아니면 로그인 버튼만 있는 머리글을 씌운다 (GuideShell).
export default function Page() {
  return (
    <GuideShell>
      <GuideScreen />
    </GuideShell>
  );
}
