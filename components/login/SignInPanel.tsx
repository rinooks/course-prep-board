"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useInAppBrowserName } from "./useInAppBrowserName";

interface SignInPanelProps {
  /** 로그인 상태나 초대 여부를 확인하는 중이면 true (버튼을 잠근다) */
  checking: boolean;
}

/** 로그인 히어로 왼쪽: 제목 + 설명 + 버튼 2개("Google로 로그인", "이용 안내 보기") (design.md 6장) */
export function SignInPanel({ checking }: SignInPanelProps) {
  const { signIn, signingIn, error, user } = useAuth();
  const inAppBrowserName = useInAppBrowserName();

  const busy = checking || signingIn;
  let busyText = "로그인 상태를 확인하는 중…";
  if (signingIn) busyText = "로그인 창에서 계정을 골라 주세요…";
  else if (user) busyText = "초대된 계정인지 확인하는 중…";

  return (
    <>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-primary">강사 팀 전용</p>
        <h1 className="text-4xl font-bold tracking-tight text-ink text-balance md:text-6xl">
          흩어진 강의 준비를 한 보드에서
        </h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted">
          고객사 요청 확인부터 사후 설문까지, 과정별 준비 단계와 체크리스트를 팀이 함께 관리합니다.
        </p>
      </div>

      {inAppBrowserName ? (
        <Alert tone="warning" title="다른 브라우저에서 열어 주세요">
          {inAppBrowserName} 안에서 열린 화면에서는 구글 로그인이 막힙니다. 화면 메뉴의 ‘다른 브라우저로
          열기’를 눌러 Chrome이나 Safari에서 이 주소를 열어 주세요.
        </Alert>
      ) : null}

      {/* 진행 중에는 버튼 글자가 지금 상태를 알려 주므로, 스피너 낭독 문구는 짧게 둔다 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="w-full sm:w-auto" onClick={signIn} loading={busy} loadingLabel="잠시만요">
          {busy ? busyText : "Google로 로그인"}
        </Button>
        <ButtonLink href="#guide" variant="outline" className="w-full sm:w-auto">
          이용 안내 보기
        </ButtonLink>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <p className="max-w-prose text-sm leading-relaxed text-muted">
        관리자가 초대한 구글 계정으로만 들어올 수 있습니다. 로그인 창이 뜨지 않으면 브라우저의 팝업 차단을 풀고
        버튼을 다시 눌러 주세요.
      </p>
    </>
  );
}
