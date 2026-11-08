// 초안·결과물 글을 읽기 좋은 문서 모양으로 그린다 (화면 미리보기, PDF 인쇄 화면).
// parseMarkdownBlocks가 나눈 덩어리를 React 요소로만 그리므로, 글 안에 HTML이 있어도 실행되지 않는다.

import { cn } from "@/components/ui/cn";
import { parseMarkdownBlocks, splitBold } from "@/lib/domain/markdown";

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, index) =>
        part.bold ? (
          <strong key={index} className="font-semibold text-ink">
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

const HEADING_CLASS = {
  1: "text-2xl font-bold tracking-tight text-ink text-balance",
  2: "mt-2 text-xl font-bold tracking-tight text-ink",
  3: "text-base font-bold tracking-tight text-ink",
} as const;

interface MarkdownViewProps {
  markdown: string;
  className?: string;
}

export function MarkdownView({ markdown, className }: MarkdownViewProps) {
  const blocks = parseMarkdownBlocks(markdown);
  if (blocks.length === 0) return <p className="text-sm text-muted">내용이 없습니다.</p>;

  return (
    <div className={cn("flex max-w-prose flex-col gap-3 text-base leading-relaxed text-ink", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Heading = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return (
            <Heading key={index} className={HEADING_CLASS[block.level]}>
              <Inline text={block.text} />
            </Heading>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className={cn("flex flex-col gap-1 pl-6", block.ordered ? "list-decimal" : "list-disc")}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={index}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
