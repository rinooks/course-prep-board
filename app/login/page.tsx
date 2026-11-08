import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/login/LoginScreen";
import { LoadingBlock } from "@/components/ui/Spinner";

export const metadata: Metadata = {
  title: "로그인 · 강의 준비 보드",
};

// LoginScreen이 주소의 ?next= 값을 읽어서(useSearchParams) Suspense 경계가 필요하다
export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock fullScreen label="로그인 화면을 준비하는 중입니다…" />}>
      <LoginScreen />
    </Suspense>
  );
}
