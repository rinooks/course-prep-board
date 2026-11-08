// "슬라이드별 내용" 초안 글을 슬라이드 목록으로 나눈다 (PPT 내보내기용). 순수 함수.
// 형식 (요청문에서 AI에게 이렇게 쓰라고 한다):
//   # 발표 제목
//   ## 슬라이드 제목
//   - 핵심 메시지
//   노트: 발표자가 말할 내용
// AI가 형식을 조금 어겨도(번호 붙인 제목, "> 노트:", 목록 기호 없음) 최대한 읽어 낸다.

import { stripBold } from "./markdown";

export interface Slide {
  title: string;
  bullets: string[];
  notes: string;
}

export interface SlideDeck {
  /** "# 발표 제목". 없으면 null */
  title: string | null;
  slides: Slide[];
}

const SLIDE_PREFIX = /^슬라이드\s*\d+\s*[:.)\-–]?\s*/;
const NOTES_START = /^>?\s*(?:발표\s*)?노트\s*[:：]\s*(.*)$/;
const LIST_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

function cleanTitle(text: string): string {
  return stripBold(text.replace(SLIDE_PREFIX, "").trim());
}

export function parseSlides(markdown: string): SlideDeck {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let title: string | null = null;
  const slides: Slide[] = [];
  let current: Slide | null = null;
  let inNotes = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (/^#\s+/.test(line) && title === null && slides.length === 0) {
      title = cleanTitle(line.replace(/^#\s+/, ""));
      continue;
    }
    if (/^#{1,2}\s+/.test(line)) {
      current = { title: cleanTitle(line.replace(/^#{1,2}\s+/, "")), bullets: [], notes: "" };
      slides.push(current);
      inNotes = false;
      continue;
    }
    if (!current) continue; // 첫 슬라이드 앞의 설명 글은 버린다

    const notes = NOTES_START.exec(line);
    if (notes) {
      inNotes = true;
      if (notes[1].trim()) current.notes = stripBold(notes[1].trim());
      continue;
    }
    if (inNotes) {
      const text = stripBold(line.replace(/^>\s?/, ""));
      current.notes = current.notes ? `${current.notes}\n${text}` : text;
      continue;
    }
    // ### 소제목이나 기호 없는 줄도 핵심 메시지로 본다
    const bullet = stripBold(line.replace(/^#{3,6}\s+/, "").replace(LIST_MARKER, ""));
    if (bullet) current.bullets.push(bullet);
  }

  return { title, slides: slides.filter((slide) => slide.title.length > 0 || slide.bullets.length > 0) };
}
