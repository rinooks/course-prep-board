// 결과물 내보내기(PRD F7)의 순수 부분: 파일 이름 만들기, 슬라이드 글 → PPT 모형(plain object) 바꾸기.
// pptxgenjs 호출은 components/outputs/exportPptx.ts에만 둔다. 여기는 브라우저·라이브러리 없이 테스트할 수 있다.

import type { DraftKind } from "./drafts";
import type { SlideDeck } from "./slides";

// ---------- 파일 이름 ----------

/** 파일 이름에 쓰는 종류 이름. 띄어쓰기 없이 짧게 */
export const EXPORT_KIND_FILE_LABELS: Record<DraftKind, string> = {
  curriculum: "커리큘럼",
  slides: "슬라이드",
  lab: "실습안내서",
};

/** 과정 이름 부분의 최대 글자 수. 너무 긴 파일 이름은 윈도우 탐색기·메일 첨부에서 잘린다 */
export const FILE_NAME_PART_MAX = 60;

/** 윈도우·맥에서 파일 이름에 못 쓰는 글자 */
const INVALID_FILE_CHARS = /[\\/:*?"<>|]/g;

/** 보이지 않는 제어 문자(줄바꿈·탭 제외 0~31번, 127번)인지 */
function isControlChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code < 32 && char !== "\n" && char !== "\t" && char !== "\r") || code === 127;
}

/**
 * 파일 이름 한 조각으로 쓸 수 있게 정리한다.
 * - 못 쓰는 글자·제어 문자는 "_"로 바꾼다
 * - 줄바꿈·여러 칸 띄어쓰기는 한 칸으로, 앞뒤 공백과 앞뒤 마침표는 뺀다 (윈도우가 끝 마침표를 지운다)
 * - 너무 길면 자른다. 다 지워져 비면 fallback을 쓴다
 */
export function safeFileNamePart(text: string, fallback: string): string {
  const cleaned = Array.from(text.normalize("NFC"))
    .map((char) => (isControlChar(char) ? "_" : char))
    .join("")
    .replace(INVALID_FILE_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "");
  // 글자 단위로 자른다 (한글·이모지가 반쪽으로 잘리지 않게)
  const limited = Array.from(cleaned).slice(0, FILE_NAME_PART_MAX).join("");
  const trimmedEnd = limited.replace(/[.\s]+$/, "");
  return trimmedEnd.length > 0 ? trimmedEnd : fallback;
}

/** 확장자 없는 파일 이름: "{과정 이름}_{종류}_{N}판". PDF는 인쇄 창이 이 이름(문서 제목)을 기본 파일 이름으로 쓴다 */
export function exportBaseName(courseTitle: string, kind: DraftKind, version: number): string {
  return `${safeFileNamePart(courseTitle, "과정")}_${EXPORT_KIND_FILE_LABELS[kind]}_${version}판`;
}

/** PPT 파일 이름: "{과정 이름}_슬라이드_{N}판.pptx" */
export function pptxFileName(courseTitle: string, version: number): string {
  return `${exportBaseName(courseTitle, "slides", version)}.pptx`;
}

// ---------- PPT 모형 ----------

/**
 * 16:9 슬라이드(10 × 5.625인치) 안의 본문 상자 크기. exportPptx.ts가 같은 값으로 그린다.
 * 글자 크기를 고를 때 이 상자에 들어가는지 계산한다.
 */
export const PPTX_BODY_BOX = { x: 0.6, y: 1.35, w: 8.8, h: 3.7 } as const;

/** 본문 글자 크기 후보 (pt). 큰 것부터 넣어 보고 상자에 들어가는 가장 큰 크기를 쓴다 */
export const BULLET_FONT_SIZES = [20, 18, 16, 14] as const;

/** 문단 사이 간격 (pt). exportPptx.ts의 paraSpaceAfter와 같다 */
export const BULLET_PARA_SPACE_PT = 6;

/** 줄 높이 배수. exportPptx.ts의 lineSpacingMultiple과 같다 */
export const BULLET_LINE_SPACING = 1.15;

/** 글머리표 들여쓰기 (pt) */
const BULLET_INDENT_PT = 27;

/**
 * 글머리표 목록이 본문 상자에 들어가는 가장 큰 글자 크기.
 * 한글 한 글자 폭 ≈ 글자 크기(pt)로 보고 줄 수를 어림한다.
 * 가장 작은 크기로도 넘치면 가장 작은 크기를 돌려준다 (PowerPoint에서 다듬을 수 있게 내용은 그대로 둔다).
 */
export function bulletFontSize(bullets: readonly string[]): number {
  const boxWidthPt = PPTX_BODY_BOX.w * 72 - BULLET_INDENT_PT;
  const boxHeightPt = PPTX_BODY_BOX.h * 72;
  for (const size of BULLET_FONT_SIZES) {
    const charsPerLine = Math.max(1, Math.floor(boxWidthPt / size));
    const lines = bullets.reduce(
      (sum, bullet) => sum + Math.max(1, Math.ceil(Array.from(bullet).length / charsPerLine)),
      0,
    );
    const height = lines * size * BULLET_LINE_SPACING + bullets.length * BULLET_PARA_SPACE_PT;
    if (height <= boxHeightPt) return size;
  }
  return BULLET_FONT_SIZES[BULLET_FONT_SIZES.length - 1];
}

export interface PptxSlideModel {
  /** 1부터. 표지는 세지 않는다 */
  number: number;
  title: string;
  bullets: string[];
  /** 발표 노트 (여러 줄은 한 문단으로 이어 붙인다). 없으면 빈 문자열 */
  notes: string;
  /** 본문 글자 크기 (pt) */
  fontSize: number;
}

export interface PptxModel {
  /** 표지 제목: 발표 제목, 없으면 과정 이름 */
  title: string;
  /** 표지 부제목: 고객사 · 과정 이름(발표 제목과 다를 때). 없으면 빈 문자열 */
  subtitle: string;
  slides: PptxSlideModel[];
}

export interface PptxContext {
  courseTitle: string;
  client: string;
}

export type PptxModelResult = { ok: true; model: PptxModel } | { ok: false; reason: "no-slides" };

/**
 * parseSlides 결과 → PPT 모형. 슬라이드가 하나도 없으면 실패를 돌려준다
 * (초안이 "## 슬라이드 제목" 형식이 아니라는 뜻이라, 빈 PPT를 내려받게 하지 않는다).
 */
export function buildPptxModel(deck: SlideDeck, context: PptxContext): PptxModelResult {
  const courseTitle = context.courseTitle.trim();
  const deckTitle = deck.title?.trim() ?? "";
  const slides = deck.slides
    .map((slide) => ({
      title: slide.title.trim(),
      bullets: slide.bullets.map((bullet) => bullet.trim()).filter((bullet) => bullet.length > 0),
      // pptxgenjs는 노트를 글 한 덩어리로 넣어, 줄바꿈 글자가 PowerPoint에서 줄바꿈으로 보이지 않는다. 띄어쓰기로 잇는다
      notes: slide.notes.replace(/\s*\n\s*/g, " ").trim(),
    }))
    .filter((slide) => slide.title.length > 0 || slide.bullets.length > 0);

  if (slides.length === 0) return { ok: false, reason: "no-slides" };

  const title = deckTitle || courseTitle || "강의 자료";
  const subtitle = [context.client.trim(), deckTitle && deckTitle !== courseTitle ? courseTitle : ""]
    .filter((part) => part.length > 0)
    .join(" · ");

  return {
    ok: true,
    model: {
      title,
      subtitle,
      slides: slides.map((slide, index) => ({
        number: index + 1,
        title: slide.title || `슬라이드 ${index + 1}`,
        bullets: slide.bullets,
        notes: slide.notes,
        fontSize: bulletFontSize(slide.bullets),
      })),
    },
  };
}
