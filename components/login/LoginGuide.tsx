import { pageContainerClass } from "@/components/layout/Page";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

const STEPS = [
  {
    title: "관리자에게 초대 요청",
    body: "팀 관리자에게 평소 쓰는 구글 계정 이메일을 알려 주세요. 초대된 계정만 들어올 수 있습니다.",
  },
  {
    title: "Google로 로그인",
    body: "초대받은 계정으로 로그인하면 바로 홈으로 들어갑니다. 로그인 창이 뜨지 않으면 브라우저의 팝업 차단을 풀어 주세요.",
  },
  {
    title: "과정 보드에서 함께 준비",
    body: "과정마다 칸반 보드와 체크리스트로 준비 상황을 나눕니다. 다른 강사가 바꾼 내용도 새로고침 없이 보입니다.",
  },
] as const;

/** 로그인 화면 아래 이용 안내. 히어로의 "이용 안내 보기" 버튼이 #guide로 내려온다. */
export function LoginGuide() {
  return (
    <section id="guide" aria-labelledby="guide-title" className="scroll-mt-16 border-t border-line bg-white py-16 md:py-20">
      <div className={cn(pageContainerClass("default"), "flex flex-col gap-8")}>
        <h2 id="guide-title" className="text-3xl font-bold tracking-tight text-ink text-balance md:text-4xl">
          처음 쓰는 분은 이렇게 시작하세요
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card padding="lg" className="flex h-full flex-col gap-2">
                <p className="text-sm font-semibold text-primary">{index + 1}단계</p>
                <h3 className="text-xl font-bold tracking-tight text-ink">{step.title}</h3>
                <p className="leading-relaxed text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <p className="leading-relaxed text-muted">앱으로 무엇을 할 수 있는지 더 알고 싶다면</p>
          <ButtonLink href="/guide" variant="outline">
            앱 소개 자세히 보기
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
