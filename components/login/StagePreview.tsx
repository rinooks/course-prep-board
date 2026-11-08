import { StageNumber } from "@/components/course/StageNumber";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/Section";
import { STAGES } from "@/lib/domain/stages";

/** 로그인 히어로 오른쪽: 이 앱이 관리하는 강의 준비 7단계를 보여준다 */
export function StagePreview() {
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <SectionHeading description="단계마다 기본 카드와 체크리스트가 자동으로 생깁니다.">
        과정마다 7단계로 준비합니다
      </SectionHeading>
      <ol className="flex flex-col gap-2">
        {STAGES.map((stage) => (
          <li key={stage.id} className="flex items-center gap-3 rounded-card border border-line px-3 py-2">
            <StageNumber order={stage.order} />
            <span className="font-semibold text-ink">{stage.label}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
