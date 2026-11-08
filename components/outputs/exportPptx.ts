// "슬라이드별 내용" 결과물 → PowerPoint 파일 (PRD F7, 가정 A8: 앱 기본 디자인).
// pptxgenjs는 크기가 커서(수백 KB) 버튼을 누른 순간에만 불러온다 (import 타입만 위에 둔다).
// 무엇을 그릴지(제목·글머리표·글자 크기)는 lib/domain/exportFiles.ts의 buildPptxModel이 정하고, 여기는 그리기만 한다.

import type PptxGenJS from "pptxgenjs";
import { withTimeout } from "@/lib/domain/async";
import {
  BULLET_LINE_SPACING,
  BULLET_PARA_SPACE_PT,
  PPTX_BODY_BOX,
  type PptxModel,
  type PptxSlideModel,
} from "@/lib/domain/exportFiles";

/** 라이브러리 내려받기 시간 제한. 연결이 끊기면 버튼이 계속 "처리 중"으로 남지 않게 한다 */
const LIBRARY_LOAD_TIMEOUT_MS = 20_000;
/** 파일 만들기 시간 제한 (슬라이드가 아주 많아도 보통 몇 초 안에 끝난다) */
const WRITE_TIMEOUT_MS = 30_000;

// design.md 2장 색 (pptxgenjs는 # 없는 16진수를 쓴다)
const NAVY = "1E2A5A";
const INK = "0F172A";
const MUTED = "64748B";
const WHITE = "FFFFFF";
const LINE = "E2E8F0";

/** 윈도우 PowerPoint에 기본으로 들어 있는 한글 글꼴 (맥에서는 비슷한 글꼴로 바뀌어 보인다) */
const FONT = "Malgun Gothic";

const BODY_MASTER = "LECTURE_BODY";
const TITLE_MASTER = "LECTURE_TITLE";

/** 16:9 슬라이드 크기 (인치) */
const SLIDE_W = 10;
const SLIDE_H = 5.625;

function defineMasters(pres: PptxGenJS): void {
  // 표지: 흰 바탕 + 왼쪽 네이비 세로 막대
  pres.defineSlideMaster({
    title: TITLE_MASTER,
    background: { color: WHITE },
    objects: [{ rect: { x: 0, y: 0, w: 0.35, h: SLIDE_H, fill: { color: NAVY }, line: { color: NAVY } } }],
  });
  // 본문: 흰 바탕 + 제목 아래 짧은 네이비 막대 + 아래쪽 옅은 줄 + 오른쪽 아래 쪽 번호
  pres.defineSlideMaster({
    title: BODY_MASTER,
    background: { color: WHITE },
    objects: [
      { rect: { x: 0.6, y: 1.1, w: 1.2, h: 0.06, fill: { color: NAVY }, line: { color: NAVY } } },
      { line: { x: 0.6, y: 5.15, w: SLIDE_W - 1.2, h: 0, line: { color: LINE, width: 0.75 } } },
    ],
    slideNumber: { x: SLIDE_W - 1.1, y: 5.2, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: "right" },
  });
}

function addTitleSlide(pres: PptxGenJS, model: PptxModel): void {
  const slide = pres.addSlide({ masterName: TITLE_MASTER });
  slide.addText(model.title, {
    x: 0.9,
    y: 1.6,
    w: SLIDE_W - 1.8,
    h: 1.5,
    fontFace: FONT,
    fontSize: 36,
    bold: true,
    color: NAVY,
    valign: "bottom",
    fit: "shrink",
  });
  if (model.subtitle) {
    slide.addText(model.subtitle, {
      x: 0.9,
      y: 3.25,
      w: SLIDE_W - 1.8,
      h: 0.8,
      fontFace: FONT,
      fontSize: 18,
      color: MUTED,
      valign: "top",
      fit: "shrink",
    });
  }
}

function addBodySlide(pres: PptxGenJS, model: PptxSlideModel): void {
  const slide = pres.addSlide({ masterName: BODY_MASTER });
  slide.addText(model.title, {
    x: 0.6,
    y: 0.3,
    w: SLIDE_W - 1.2,
    h: 0.75,
    fontFace: FONT,
    fontSize: 26,
    bold: true,
    color: NAVY,
    valign: "bottom",
    fit: "shrink",
  });
  if (model.bullets.length > 0) {
    const lastIndex = model.bullets.length - 1;
    slide.addText(
      model.bullets.map((text, index) => ({
        text,
        // 마지막 줄 뒤에는 빈 문단을 만들지 않는다
        options: { bullet: true, breakLine: index < lastIndex },
      })),
      {
        ...PPTX_BODY_BOX,
        fontFace: FONT,
        fontSize: model.fontSize,
        color: INK,
        valign: "top",
        paraSpaceAfter: BULLET_PARA_SPACE_PT,
        lineSpacingMultiple: BULLET_LINE_SPACING,
        fit: "shrink",
      },
    );
  }
  if (model.notes) slide.addNotes(model.notes);
}

/**
 * PPT 파일을 만들어 내려받게 한다. 실패하면 오류를 던진다 (화면에서 안내 문구로 바꾼다).
 * @param fileName pptxFileName()으로 만든 이름 ("….pptx")
 */
export async function downloadSlidesPptx(model: PptxModel, fileName: string): Promise<void> {
  const { default: PptxGen } = await withTimeout(import("pptxgenjs"), LIBRARY_LOAD_TIMEOUT_MS);
  const pres = new PptxGen();
  pres.layout = "LAYOUT_16x9";
  pres.title = model.title;
  pres.subject = model.subtitle || model.title;
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

  defineMasters(pres);
  addTitleSlide(pres, model);
  for (const slide of model.slides) addBodySlide(pres, slide);

  await withTimeout(pres.writeFile({ fileName, compression: true }), WRITE_TIMEOUT_MS);
}
