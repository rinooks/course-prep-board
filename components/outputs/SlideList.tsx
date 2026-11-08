// "슬라이드별 내용"을 슬라이드 한 장씩 보여준다 (미리보기 창, PDF 인쇄 화면).
// 인쇄할 때 슬라이드 하나가 두 쪽으로 갈라지지 않게 break-inside-avoid를 건다.

import { Card } from "@/components/ui/Card";
import type { Slide } from "@/lib/domain/slides";

interface SlideListProps {
  slides: readonly Slide[];
  /** 슬라이드 제목의 제목 단계. 미리보기 창 안은 h3, 인쇄 문서는 h2 */
  headingAs?: "h2" | "h3";
}

export function SlideList({ slides, headingAs = "h3" }: SlideListProps) {
  const Heading = headingAs;
  return (
    <ol className="flex flex-col gap-3">
      {slides.map((slide, index) => (
        <li key={index} className="break-inside-avoid">
          <Card padding="sm" flat className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-muted tabular-nums">슬라이드 {index + 1}</p>
              <Heading className="text-base font-semibold text-ink">{slide.title || "제목 없음"}</Heading>
            </div>
            {slide.bullets.length > 0 ? (
              <ul className="flex list-disc flex-col gap-1 pl-6 text-base leading-relaxed text-ink">
                {slide.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {slide.notes ? (
              <p className="whitespace-pre-line border-t border-line pt-2 text-sm leading-relaxed text-muted">
                <span className="font-semibold">발표 노트</span> {slide.notes}
              </p>
            ) : null}
          </Card>
        </li>
      ))}
    </ol>
  );
}
