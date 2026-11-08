// 초안·결과물 글(마크다운 일부)을 화면·PDF·PPT용 덩어리로 나눈다. 순수 함수.
// AI 답에 자주 나오는 것만 다룬다: 제목(#, ##, ###), 목록(-, *, 1.), 문단, 굵게(**…**).
// HTML로 바꾸지 않고 덩어리로만 돌려주므로, 화면에 그릴 때 글이 코드로 실행될 일이 없다.

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  const pushItem = (ordered: boolean, item: string) => {
    flushParagraph();
    const last = blocks[blocks.length - 1];
    if (last && last.type === "list" && last.ordered === ordered) {
      last.items.push(item);
    } else {
      blocks.push({ type: "list", ordered, items: [item] });
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().length === 0) {
      flushParagraph();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading) {
      flushParagraph();
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: heading[2].trim() });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      pushItem(false, bullet[1].trim());
      continue;
    }
    const numbered = NUMBERED.exec(line);
    if (numbered) {
      pushItem(true, numbered[1].trim());
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  return blocks;
}

export interface InlinePart {
  text: string;
  bold: boolean;
}

/** "**굵게**"를 나눈다. 짝이 안 맞는 **는 그냥 글자로 둔다 */
export function splitBold(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), bold: false });
    parts.push({ text: match[1], bold: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts.length > 0 ? parts : [{ text: "", bold: false }];
}

/** 굵게 표시를 뺀 글 (PPT처럼 꾸밈을 못 넣는 곳) */
export function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
