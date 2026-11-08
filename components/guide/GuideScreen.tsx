import Link from "next/link";
import { StageNumber } from "@/components/course/StageNumber";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { BentoGrid } from "@/components/ui/Bento";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/Section";
import { STAGES } from "@/lib/domain/stages";
import { FEATURES, FLOW, PROBLEMS, TIPS, type GuideFeature } from "./guideContent";

const CARD_TITLE = "text-lg font-bold tracking-tight text-ink text-balance";

/**
 * 이용 안내(/guide): 이 앱이 무엇인지, 무엇을 할 수 있는지 소개한다.
 * 데이터를 읽지 않는 고정 화면이라 로그인 여부와 상관없이 같은 내용을 보여준다. 문구는 guideContent.ts에 있다.
 */
export function GuideScreen() {
  return (
    <>
      <PageHeader
        eyebrow="이용 안내"
        title="강의 준비 보드는 이런 앱입니다"
        description="동료 강사들이 강의 준비 재료를 과정별로 한곳에 모으고, 그 재료로 교안과 실습 자료를 만들어 PPT·PDF로 꺼내는 팀용 보드입니다."
      />
      <PageBody>
        <Section title="이런 문제를 풉니다">
          <ul className="grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((problem) => (
              <li key={problem.title}>
                <Card className="flex h-full flex-col gap-2">
                  <h3 className={CARD_TITLE}>{problem.title}</h3>
                  <p className="leading-relaxed text-muted">{problem.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          tile
          title="과정마다 7단계로 준비합니다"
          description="새 과정을 만들면 7단계 칸과 단계별 기본 카드·체크리스트가 자동으로 생깁니다. 카드를 다음 칸으로 옮기며 준비를 이어 갑니다."
        >
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {STAGES.map((stage) => (
              <li key={stage.id}>
                <Card padding="sm" flat className="flex h-full items-center gap-3 lg:flex-col lg:items-start lg:gap-2">
                  <StageNumber order={stage.order} />
                  <span className="font-semibold text-ink">{stage.label}</span>
                </Card>
              </li>
            ))}
          </ol>
        </Section>

        <BentoGrid layout="halves">
          <Section tile title="이렇게 씁니다">
            <ol className="flex flex-col divide-y divide-line">
              {FLOW.map((step, index) => (
                <li key={step.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {/* 순서는 ol이 알려 주므로 숫자 칸은 화면 낭독기가 읽지 않는다 */}
                  <span
                    aria-hidden="true"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-button bg-primary text-xs font-bold text-primary-foreground tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-base font-bold tracking-tight text-ink">{step.title}</h3>
                    <p className="max-w-prose leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section tile title="알아 두면 좋은 점">
            <ul className="flex flex-col gap-3">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span className="max-w-prose leading-relaxed text-ink">{tip}</span>
                </li>
              ))}
            </ul>
          </Section>
        </BentoGrid>

        <Section title="메뉴별로 할 수 있는 일">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <FeatureCard feature={feature} />
              </li>
            ))}
          </ul>
        </Section>
      </PageBody>
    </>
  );
}

/** 기능 카드 하나. 바로 갈 화면이 있으면 카드 전체가 링크가 된다 (홈의 과정 카드와 같은 방식) */
function FeatureCard({ feature }: { feature: GuideFeature }) {
  const content = (
    <>
      <p className="text-sm font-semibold text-primary">{feature.where}</p>
      <h3 className={cn(CARD_TITLE, feature.href && "group-hover:text-primary")}>{feature.title}</h3>
      <p className="leading-relaxed text-muted">{feature.body}</p>
    </>
  );

  if (!feature.href) {
    return <Card className="flex h-full flex-col gap-2">{content}</Card>;
  }

  return (
    <Link href={feature.href} className={cn("group block h-full rounded-tile", focusRing)}>
      <Card interactive className="flex h-full flex-col gap-2">
        {content}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary">
          바로 가기
          <ChevronRightIcon />
        </span>
      </Card>
    </Link>
  );
}
