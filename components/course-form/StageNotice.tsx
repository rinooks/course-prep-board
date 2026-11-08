import { Alert } from "@/components/ui/Alert";
import { DEFAULT_TEMPLATE, STAGES } from "@/lib/domain/stages";

/** "7단계와 기본 카드가 자동으로 생긴다" 안내 */
export function StageNotice() {
  return (
    <Alert tone="info" title={`${STAGES.length}단계 칸과 기본 카드가 자동으로 생깁니다`}>
      <p>
        과정을 만들면 단계별 기본 카드 {DEFAULT_TEMPLATE.length}장과 체크리스트가 함께 준비됩니다. 기본 카드는 보드에서
        고치거나 지울 수 있습니다.
      </p>
      <ol className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-muted">
        {STAGES.map((stage, index) => (
          <li key={stage.id} className="whitespace-nowrap">
            {index + 1}. {stage.label}
            {index < STAGES.length - 1 ? (
              <span aria-hidden="true" className="ml-2">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Alert>
  );
}
