import { describe, expect, it } from "vitest";
import {
  BULLET_FONT_SIZES,
  FILE_NAME_PART_MAX,
  buildPptxModel,
  bulletFontSize,
  exportBaseName,
  pptxFileName,
  safeFileNamePart,
} from "@/lib/domain/exportFiles";
import { parseSlides } from "@/lib/domain/slides";

describe("파일 이름 정리", () => {
  it("파일 이름에 못 쓰는 글자를 _로 바꾼다", () => {
    expect(safeFileNamePart('리더십: "코칭"/피드백 <1차>?*|\\', "과정")).toBe("리더십_ _코칭__피드백 _1차_____");
  });

  it("제어 문자는 _로, 줄바꿈과 여러 칸 띄어쓰기는 한 칸으로 바꾼다", () => {
    expect(safeFileNamePart("AI\u0007 활용\n\n과정   1기", "과정")).toBe("AI_ 활용 과정 1기");
  });

  it("앞뒤 공백과 마침표를 뺀다 (윈도우는 끝 마침표를 지운다)", () => {
    expect(safeFileNamePart("  ..숨김 과정...  ", "과정")).toBe("숨김 과정");
  });

  it("다 지워져 비면 기본 이름을 쓴다", () => {
    expect(safeFileNamePart("   ", "과정")).toBe("과정");
    expect(safeFileNamePart("...", "과정")).toBe("과정");
  });

  it("너무 길면 글자 단위로 자른다 (한글이 반쪽으로 잘리지 않는다)", () => {
    const long = "가".repeat(FILE_NAME_PART_MAX + 20);
    const result = safeFileNamePart(long, "과정");
    expect(Array.from(result)).toHaveLength(FILE_NAME_PART_MAX);
    expect(result).toBe("가".repeat(FILE_NAME_PART_MAX));
  });

  it("조합형 한글을 완성형(NFC)으로 바꾼다", () => {
    const decomposed = "한글".normalize("NFD");
    expect(safeFileNamePart(decomposed, "과정")).toBe("한글");
  });

  it("PPT 파일 이름은 {과정 이름}_슬라이드_{N}판.pptx", () => {
    expect(pptxFileName("신입사원 온보딩", 3)).toBe("신입사원 온보딩_슬라이드_3판.pptx");
    expect(pptxFileName("A/B 테스트?", 1)).toBe("A_B 테스트__슬라이드_1판.pptx");
  });

  it("PDF용 이름은 종류마다 다른 이름을 쓰고 확장자가 없다", () => {
    expect(exportBaseName("데이터 문해력", "curriculum", 2)).toBe("데이터 문해력_커리큘럼_2판");
    expect(exportBaseName("데이터 문해력", "lab", 1)).toBe("데이터 문해력_실습안내서_1판");
    expect(exportBaseName("", "slides", 4)).toBe("과정_슬라이드_4판");
  });
});

describe("본문 글자 크기 고르기", () => {
  it("짧은 목록은 가장 큰 글자를 쓴다", () => {
    expect(bulletFontSize(["첫째 메시지", "둘째 메시지", "셋째 메시지"])).toBe(BULLET_FONT_SIZES[0]);
  });

  it("빈 목록도 가장 큰 글자를 쓴다", () => {
    expect(bulletFontSize([])).toBe(BULLET_FONT_SIZES[0]);
  });

  it("목록이 길수록 글자가 작아지고, 아무리 길어도 가장 작은 크기 아래로는 내려가지 않는다", () => {
    // 40자짜리 6줄: 큰 글자로는 한 항목이 두 줄씩 차지해 넘친다
    const medium = Array.from({ length: 6 }, () => "가".repeat(40));
    const huge = Array.from({ length: 30 }, () => "아주 긴 문장 ".repeat(10));
    const largest = BULLET_FONT_SIZES[0];
    const smallest = BULLET_FONT_SIZES[BULLET_FONT_SIZES.length - 1];
    const mid = bulletFontSize(medium);
    expect(BULLET_FONT_SIZES).toContain(mid);
    expect(mid).toBeLessThan(largest);
    expect(mid).toBeGreaterThan(smallest);
    expect(bulletFontSize(huge)).toBe(smallest);
  });
});

describe("슬라이드 글 → PPT 모형", () => {
  const context = { courseTitle: "AI 활용 리더십", client: "가나다전자" };

  it("발표 제목·슬라이드·글머리표·노트를 그대로 옮긴다", () => {
    const deck = parseSlides(
      [
        "# 생성형 AI 첫걸음",
        "## 오늘의 목표",
        "- AI가 잘하는 일 알기",
        "- **업무에** 바로 써 보기",
        "노트: 시작하며 참여자의 경험을 묻습니다.",
        "## 실습 안내",
        "- 프롬프트 세 가지 써 보기",
      ].join("\n"),
    );
    const result = buildPptxModel(deck, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.title).toBe("생성형 AI 첫걸음");
    // 발표 제목이 과정 이름과 다르면 부제목에 과정 이름을 함께 넣는다
    expect(result.model.subtitle).toBe("가나다전자 · AI 활용 리더십");
    expect(result.model.slides).toEqual([
      {
        number: 1,
        title: "오늘의 목표",
        bullets: ["AI가 잘하는 일 알기", "업무에 바로 써 보기"],
        notes: "시작하며 참여자의 경험을 묻습니다.",
        fontSize: BULLET_FONT_SIZES[0],
      },
      {
        number: 2,
        title: "실습 안내",
        bullets: ["프롬프트 세 가지 써 보기"],
        notes: "",
        fontSize: BULLET_FONT_SIZES[0],
      },
    ]);
  });

  it("발표 제목이 없으면 과정 이름을 표지 제목으로 쓰고, 부제목에 과정 이름을 겹쳐 넣지 않는다", () => {
    const deck = parseSlides("## 들어가며\n- 인사");
    const result = buildPptxModel(deck, context);
    expect(result.ok && result.model.title).toBe("AI 활용 리더십");
    expect(result.ok && result.model.subtitle).toBe("가나다전자");
  });

  it("고객사가 없으면 부제목이 비거나 과정 이름만 남는다", () => {
    const withoutClient = { courseTitle: "AI 활용 리더십", client: "  " };
    const sameTitle = buildPptxModel(parseSlides("# AI 활용 리더십\n## 첫 장\n- 내용"), withoutClient);
    expect(sameTitle.ok && sameTitle.model.subtitle).toBe("");
    const otherTitle = buildPptxModel(parseSlides("# 다른 제목\n## 첫 장\n- 내용"), withoutClient);
    expect(otherTitle.ok && otherTitle.model.subtitle).toBe("AI 활용 리더십");
  });

  it("제목 없이 글머리표만 있는 슬라이드는 '슬라이드 N'으로 이름을 붙이고, 빈 글머리표는 뺀다", () => {
    const result = buildPptxModel(
      { title: null, slides: [{ title: " ", bullets: ["내용", "   "], notes: "  " }] },
      context,
    );
    expect(result.ok && result.model.slides).toEqual([
      { number: 1, title: "슬라이드 1", bullets: ["내용"], notes: "", fontSize: BULLET_FONT_SIZES[0] },
    ]);
  });

  it("여러 줄 발표 노트는 한 문단으로 잇는다 (PowerPoint 노트 칸에 줄바꿈 글자가 그대로 들어가지 않게)", () => {
    const deck = parseSlides("## 첫 장\n- 내용\n노트: 첫 줄입니다.\n  둘째 줄입니다.\r\n\r\n셋째 줄");
    const result = buildPptxModel(deck, context);
    expect(result.ok && result.model.slides[0].notes).toBe("첫 줄입니다. 둘째 줄입니다. 셋째 줄");
  });

  it("슬라이드 형식이 아니면(슬라이드 0장) 실패를 돌려준다", () => {
    expect(buildPptxModel(parseSlides("그냥 문단으로 쓴 초안입니다.\n- 목록만 있음"), context)).toEqual({
      ok: false,
      reason: "no-slides",
    });
    expect(buildPptxModel(parseSlides("# 제목만 있음"), context)).toEqual({ ok: false, reason: "no-slides" });
  });

  it("과정 이름도 발표 제목도 없으면 기본 표지 제목을 쓴다", () => {
    const result = buildPptxModel(parseSlides("## 첫 장\n- 내용"), { courseTitle: "", client: "" });
    expect(result.ok && result.model.title).toBe("강의 자료");
  });
});
