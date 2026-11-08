import { describe, expect, it } from "vitest";
import {
  buildDraftPrompt,
  draftsToPrune,
  nextVersion,
  PROMPT_CHAR_LIMIT,
  type PromptMaterial,
} from "@/lib/domain/drafts";
import { parseMarkdownBlocks, splitBold, stripBold } from "@/lib/domain/markdown";
import { EMPTY_MATERIAL_FILTER, filterMaterials, isHttpUrl, type MaterialLike } from "@/lib/domain/materials";
import { parseSlides } from "@/lib/domain/slides";

function material(overrides: Partial<PromptMaterial> & Pick<PromptMaterial, "id">): PromptMaterial {
  return {
    kind: "text",
    title: "재료",
    body: "본문",
    url: "",
    memo: "",
    stage: null,
    excludeFromAi: false,
    ...overrides,
  };
}

describe("초안 판 번호와 기록 정리", () => {
  const items = [
    { id: "c1", kind: "curriculum" as const, version: 1 },
    { id: "c2", kind: "curriculum" as const, version: 2 },
    { id: "s1", kind: "slides" as const, version: 1 },
  ];

  it("종류별로 다음 판 번호를 센다", () => {
    expect(nextVersion(items, "curriculum")).toBe(3);
    expect(nextVersion(items, "lab")).toBe(1);
  });

  it("새 판을 넣어도 종류별 limit개를 넘지 않게 오래된 판부터 지운다", () => {
    expect(draftsToPrune(items, "curriculum", 2)).toEqual(["c1"]);
    expect(draftsToPrune(items, "curriculum", 3)).toEqual([]);
    expect(draftsToPrune(items, "slides", 1)).toEqual(["s1"]);
  });
});

describe("buildDraftPrompt", () => {
  const base = {
    kind: "curriculum" as const,
    course: { title: "A사 신입사원 과정", client: "A사", description: "AI 활용 입문" },
    sessions: [{ date: "2026-10-20", startTime: "09:30", location: "본사", audience: "신입 30명" }],
    request: "실습 비중을 늘려 줘",
  };

  it("과정 정보·회차·추가 요청·형식·재료를 넣는다", () => {
    const built = buildDraftPrompt({
      ...base,
      materials: [material({ id: "m1", title: "킥오프 회의", body: "고객사 요구: 실무 중심", memo: "중요" })],
    });
    expect(built.text).toContain('"커리큘럼" 초안');
    expect(built.text).toContain("- 과정 이름: A사 신입사원 과정");
    expect(built.text).toContain("2026년 10월 20일 (화) 09:30 · 본사 · 신입 30명");
    expect(built.text).toContain("실습 비중을 늘려 줘");
    expect(built.text).toContain("### 재료 1. 킥오프 회의 (붙여 넣은 글)");
    expect(built.text).toContain("고객사 요구: 실무 중심");
    expect(built.includedIds).toEqual(["m1"]);
  });

  it("'AI에 보내지 않음' 재료는 요청문에 넣지 않는다", () => {
    const built = buildDraftPrompt({
      ...base,
      materials: [
        material({ id: "secret", title: "고객사 기밀", body: "비밀 내용", excludeFromAi: true }),
        material({ id: "ok", title: "공개 자료" }),
      ],
    });
    expect(built.text).not.toContain("비밀 내용");
    expect(built.text).not.toContain("고객사 기밀");
    expect(built.excludedIds).toEqual(["secret"]);
    expect(built.includedIds).toEqual(["ok"]);
    expect(built.text).toContain("### 재료 1. 공개 자료");
  });

  it("길이 상한을 넘으면 앞의 재료부터 넣고 나머지는 잘라 낸다", () => {
    const big = "가".repeat(PROMPT_CHAR_LIMIT);
    const built = buildDraftPrompt({
      ...base,
      materials: [material({ id: "small", body: "짧은 글" }), material({ id: "big", body: big }), material({ id: "after" })],
    });
    expect(built.text.length).toBeLessThanOrEqual(PROMPT_CHAR_LIMIT);
    expect(built.includedIds[0]).toBe("small");
    expect(built.cutIds).toContain("big");
    expect(built.text).toContain("길어서 뒷부분은 뺐습니다");
  });
});

describe("parseSlides", () => {
  it("발표 제목, 슬라이드, 핵심 메시지, 노트를 나눈다", () => {
    const deck = parseSlides(
      [
        "# AI 활용 입문",
        "",
        "## 슬라이드 1: 왜 AI인가",
        "- 업무 시간 **30%** 절약",
        "* 반복 업무 자동화",
        "노트: 첫 장에서는 공감부터 얻는다.",
        "질문을 던진다.",
        "## 실습 안내",
        "1. 계정 만들기",
        "> 노트: 실습 시간 20분",
      ].join("\r\n"),
    );
    expect(deck.title).toBe("AI 활용 입문");
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0]).toEqual({
      title: "왜 AI인가",
      bullets: ["업무 시간 30% 절약", "반복 업무 자동화"],
      notes: "첫 장에서는 공감부터 얻는다.\n질문을 던진다.",
    });
    expect(deck.slides[1]).toEqual({ title: "실습 안내", bullets: ["계정 만들기"], notes: "실습 시간 20분" });
  });

  it("발표 제목이 없어도 슬라이드를 읽는다", () => {
    const deck = parseSlides("앞 설명은 버린다\n## 첫 장\n기호 없는 줄");
    expect(deck.title).toBeNull();
    expect(deck.slides).toEqual([{ title: "첫 장", bullets: ["기호 없는 줄"], notes: "" }]);
  });
});

describe("parseMarkdownBlocks", () => {
  it("제목·목록·문단을 나눈다", () => {
    const blocks = parseMarkdownBlocks("# 제목\n## 목표\n- 하나\n- 둘\n\n1. 첫째\n2. 둘째\n문단 첫 줄\n이어지는 줄\n#### 깊은 제목");
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "제목" },
      { type: "heading", level: 2, text: "목표" },
      { type: "list", ordered: false, items: ["하나", "둘"] },
      { type: "list", ordered: true, items: ["첫째", "둘째"] },
      { type: "paragraph", text: "문단 첫 줄 이어지는 줄" },
      { type: "heading", level: 3, text: "깊은 제목" },
    ]);
  });

  it("굵게 표시를 나누거나 뺀다", () => {
    expect(splitBold("앞 **굵게** 뒤")).toEqual([
      { text: "앞 ", bold: false },
      { text: "굵게", bold: true },
      { text: " 뒤", bold: false },
    ]);
    expect(stripBold("**A** 와 **B**")).toBe("A 와 B");
  });
});

describe("재료", () => {
  it("웹 주소는 http(s)만, 공백 없이", () => {
    expect(isHttpUrl("https://drive.google.com/file/d/abc")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://exa mple.com")).toBe(false);
    expect(isHttpUrl("drive.google.com")).toBe(false);
  });

  const items: MaterialLike[] = [
    { id: "a", kind: "text", title: "킥오프 회의록", stage: "request", createdBy: "a@x.com", createdAt: 1, deletedAt: null },
    { id: "b", kind: "link", title: "교안 PPT", stage: "lecture", createdBy: "b@x.com", createdAt: 3, deletedAt: null },
    { id: "c", kind: "dictation", title: "음성 메모", stage: null, createdBy: "a@x.com", createdAt: 2, deletedAt: null },
    { id: "d", kind: "text", title: "지운 재료", stage: null, createdBy: "a@x.com", createdAt: 4, deletedAt: 9 },
  ];

  it("휴지통을 빼고 최근 순으로", () => {
    expect(filterMaterials(items, EMPTY_MATERIAL_FILTER).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("종류·단계·올린 사람·제목으로 거른다", () => {
    expect(filterMaterials(items, { ...EMPTY_MATERIAL_FILTER, kind: "text" }).map((item) => item.id)).toEqual(["a"]);
    expect(filterMaterials(items, { ...EMPTY_MATERIAL_FILTER, stage: "none" }).map((item) => item.id)).toEqual(["c"]);
    expect(filterMaterials(items, { ...EMPTY_MATERIAL_FILTER, author: "a@x.com" }).map((item) => item.id)).toEqual(["c", "a"]);
    expect(filterMaterials(items, { ...EMPTY_MATERIAL_FILTER, query: " ppt " }).map((item) => item.id)).toEqual(["b"]);
  });
});

describe("appendTranscript (받아쓰기 글 이어 붙이기)", () => {
  it("빈 글이면 그대로, 아니면 한 칸 띄워 붙이고, 줄이 끝났으면 바로 붙인다", async () => {
    const { appendTranscript } = await import("@/lib/domain/transcript");
    expect(appendTranscript("", "  안녕하세요 ")).toBe("안녕하세요");
    expect(appendTranscript("첫 문장", "둘째 문장")).toBe("첫 문장 둘째 문장");
    expect(appendTranscript("첫 줄\n", "둘째 줄")).toBe("첫 줄\n둘째 줄");
    expect(appendTranscript("그대로", "   ")).toBe("그대로");
  });
});
