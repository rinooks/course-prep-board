// 결과물 본문 보여주기 (미리보기 창, PDF 인쇄 화면 공통).
// - 슬라이드별 내용: 슬라이드 한 장씩. 슬라이드 형식이 아니면 안내와 함께 글 그대로 보여준다
// - 커리큘럼·실습 안내서: 마크다운 문서 모양

import { MarkdownView } from "@/components/course/MarkdownView";
import { Alert } from "@/components/ui/Alert";
import type { Output } from "@/lib/data/types";
import { parseSlides } from "@/lib/domain/slides";
import { SlideList } from "./SlideList";

interface OutputContentProps {
  output: Pick<Output, "kind" | "content">;
  /** 슬라이드 제목의 제목 단계. 미리보기 창 안은 h3, 인쇄 문서는 h2 */
  slideHeadingAs?: "h2" | "h3";
}

export function OutputContent({ output, slideHeadingAs = "h3" }: OutputContentProps) {
  if (output.kind !== "slides") return <MarkdownView markdown={output.content} />;

  const deck = parseSlides(output.content);
  if (deck.slides.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="warning" title="슬라이드 형식이 아닙니다" className="print:hidden">
          &apos;## 슬라이드 제목&apos;으로 나뉜 슬라이드를 찾지 못해 글을 그대로 보여 줍니다. PPT로 내려받으려면 초안 탭에서
          형식을 맞춘 뒤 다시 확정해 주세요.
        </Alert>
        <MarkdownView markdown={output.content} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {deck.title ? <p className="text-lg font-bold tracking-tight text-ink">{deck.title}</p> : null}
      <SlideList slides={deck.slides} headingAs={slideHeadingAs} />
    </div>
  );
}
