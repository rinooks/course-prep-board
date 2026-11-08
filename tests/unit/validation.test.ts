import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIMITS,
  cleanMultiline,
  cleanText,
  hasErrors,
  isValidEmail,
  normalizeEmail,
  safeNextPath,
  validateCardInput,
  validateCardPatch,
  validateCardTitle,
  validateChecklistText,
  validateCourseInput,
  validateCoursePatch,
  validateInviteEmail,
  validateRole,
  validateSessionInput,
  validateSessionPatch,
  validateStage,
  withParticle,
} from "@/lib/domain/validation";

describe("텍스트 정리", () => {
  it("cleanText: 폭 없는 문자·제어 문자 제거, 줄바꿈은 공백, 앞뒤 공백 제거", () => {
    expect(cleanText("  안​녕\u0007\n하세요  ")).toBe("안녕 하세요");
  });

  it("cleanText: 자모가 분리된 한글을 합친다(NFC)", () => {
    const decomposed = "가"; // ㄱ + ㅏ
    expect(cleanText(decomposed)).toBe("가");
  });

  it("cleanMultiline: 줄바꿈은 남긴다", () => {
    expect(cleanMultiline("첫 줄\r\n둘째 줄​ ")).toBe("첫 줄\n둘째 줄");
  });
});

describe("이메일", () => {
  it("normalizeEmail은 소문자·공백 제거", () => {
    expect(normalizeEmail("  Kim@Gmail.COM ")).toBe("kim@gmail.com");
  });

  it("isValidEmail", () => {
    expect(isValidEmail("kim@gmail.com")).toBe(true);
    expect(isValidEmail("kim@gmail")).toBe(false);
    expect(isValidEmail("kim gmail.com")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@b.co`)).toBe(false);
  });

  it("validateInviteEmail", () => {
    expect(validateInviteEmail(" Lee@Example.com ")).toEqual({ ok: true, value: "lee@example.com" });
    const empty = validateInviteEmail("  ");
    expect(empty.ok).toBe(false);
    const bad = validateInviteEmail("lee");
    expect(bad.ok === false && bad.errors.email).toContain("이메일 형식");
  });

  it("validateRole", () => {
    expect(validateRole("admin").ok).toBe(true);
    expect(validateRole("owner").ok).toBe(false);
  });
});

describe("조사", () => {
  it("받침에 따라 을/를, 은/는", () => {
    expect(withParticle("과정 이름", "을", "를")).toBe("과정 이름을");
    expect(withParticle("메모", "을", "를")).toBe("메모를");
    expect(withParticle("고객사", "은", "는")).toBe("고객사는");
    expect(withParticle("PPT", "은", "는")).toBe("PPT는");
  });
});

describe("과정 입력", () => {
  it("정리한 값을 돌려준다 (담당 강사 중복 제거·소문자)", () => {
    const result = validateCourseInput({
      title: "  A사 신입사원 AI 과정 ",
      client: "A사",
      description: "설명\n두 줄",
      instructorEmails: ["Kim@Gmail.com", "kim@gmail.com", " "],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        title: "A사 신입사원 AI 과정",
        client: "A사",
        description: "설명\n두 줄",
        instructorEmails: ["kim@gmail.com"],
      },
    });
  });

  it("이름이 없거나 너무 길면 칸별 안내", () => {
    const empty = validateCourseInput({ title: " ", client: "", description: "", instructorEmails: [] });
    expect(empty.ok === false && empty.errors.title).toBe("과정 이름을 입력해 주세요.");

    const long = validateCourseInput({
      title: "가".repeat(LIMITS.courseTitle + 1),
      client: "",
      description: "",
      instructorEmails: [],
    });
    expect(long.ok === false && long.errors.title).toContain(`${LIMITS.courseTitle}자 이내`);
  });

  it("담당 강사 수·형식 제한", () => {
    const many = validateCourseInput({
      title: "과정",
      client: "",
      description: "",
      instructorEmails: Array.from({ length: LIMITS.instructors + 1 }, (_, i) => `u${i}@a.com`),
    });
    expect(many.ok === false && many.errors.instructorEmails).toBeTruthy();
    const bad = validateCourseInput({ title: "과정", client: "", description: "", instructorEmails: ["nope"] });
    expect(bad.ok === false && bad.errors.instructorEmails).toBeTruthy();
  });

  it("validateCoursePatch는 넘어온 칸만 검사·반환한다", () => {
    expect(validateCoursePatch({ client: " B사 " })).toEqual({ ok: true, value: { client: "B사" } });
    const bad = validateCoursePatch({ title: "" });
    expect(bad.ok === false && Object.keys(bad.errors)).toEqual(["title"]);
    expect(validateCoursePatch({})).toEqual({ ok: true, value: {} });
  });
});

describe("카드 입력", () => {
  it("빈 담당자·마감일은 null", () => {
    expect(validateCardInput({ title: "카드", memo: "", assigneeEmail: "", dueDate: "" })).toEqual({
      ok: true,
      value: { title: "카드", memo: "", assigneeEmail: null, dueDate: null },
    });
  });

  it("잘못된 마감일·담당자", () => {
    const result = validateCardInput({ title: "카드", memo: "", assigneeEmail: "x", dueDate: "2026-02-30" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.assigneeEmail).toBeTruthy();
      expect(result.errors.dueDate).toBeTruthy();
    }
  });

  it("validateCardPatch / validateCardTitle / validateStage", () => {
    expect(validateCardPatch({ dueDate: "2026-10-20" })).toEqual({ ok: true, value: { dueDate: "2026-10-20" } });
    expect(validateCardPatch({ assigneeEmail: null })).toEqual({ ok: true, value: { assigneeEmail: null } });
    expect(validateCardTitle(" 제목 ")).toEqual({ ok: true, value: "제목" });
    expect(validateCardTitle("").ok).toBe(false);
    expect(validateStage("rehearsal").ok).toBe(true);
    expect(validateStage("x").ok).toBe(false);
  });

  it("체크리스트 항목", () => {
    expect(validateChecklistText(" USB ")).toEqual({ ok: true, value: "USB" });
    const empty = validateChecklistText("");
    expect(empty.ok === false && empty.errors.text).toBe("체크리스트 항목을 입력해 주세요.");
    expect(validateChecklistText("가".repeat(LIMITS.checklistText + 1)).ok).toBe(false);
  });
});

describe("회차 입력", () => {
  it("빈 시간은 null, 형식 검사", () => {
    expect(
      validateSessionInput({ date: "2026-10-20", startTime: "", location: " 본사 ", audience: "", note: "" }),
    ).toEqual({
      ok: true,
      value: { date: "2026-10-20", startTime: null, location: "본사", audience: "", note: "" },
    });
    const bad = validateSessionInput({ date: "", startTime: "25:00", location: "", audience: "", note: "" });
    expect(bad.ok === false && bad.errors.date).toBeTruthy();
    expect(bad.ok === false && bad.errors.startTime).toBeTruthy();
  });

  it("validateSessionPatch", () => {
    expect(validateSessionPatch({ startTime: "09:30" })).toEqual({ ok: true, value: { startTime: "09:30" } });
    expect(validateSessionPatch({ date: "x" }).ok).toBe(false);
  });

  it("hasErrors", () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ a: "" })).toBe(false);
    expect(hasErrors({ a: "오류" })).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("같은 사이트 경로만 허용", () => {
    expect(safeNextPath("/courses/abc")).toBe("/courses/abc");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/login?next=/x")).toBe("/");
  });

  it("탭·줄바꿈·역슬래시를 섞어 외부 주소로 바꾸는 값은 거부", () => {
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
    expect(safeNextPath("/\r/evil.example")).toBe("/");
    expect(safeNextPath("/\u0000/evil.example")).toBe("/");
    expect(safeNextPath("/courses/\\/evil.example")).toBe("/");
    expect(safeNextPath(" //evil.example")).toBe("/");
  });

  it("쿼리·해시는 그대로 두고, 점 경로는 정리한다", () => {
    expect(safeNextPath("/courses/abc?card=x1#memo")).toBe("/courses/abc?card=x1#memo");
    expect(safeNextPath("/courses/../admin")).toBe("/admin");
    expect(safeNextPath("/./login")).toBe("/");
  });
});

describe("길이 제한이 firestore.rules와 같은지", () => {
  const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");

  function ruleLimit(name: string): number {
    const match = new RegExp(`function ${name}\\(\\) \\{ return (\\d+); \\}`).exec(rules);
    if (!match) throw new Error(`firestore.rules에 ${name}()가 없습니다`);
    return Number(match[1]);
  }

  const pairs: Array<[keyof typeof LIMITS, string]> = [
    ["email", "limitEmail"],
    ["displayName", "limitDisplayName"],
    ["photoURL", "limitPhotoURL"],
    ["courseTitle", "limitCourseTitle"],
    ["courseClient", "limitCourseClient"],
    ["courseDescription", "limitCourseDescription"],
    ["instructors", "limitInstructors"],
    ["cardTitle", "limitCardTitle"],
    ["cardMemo", "limitCardMemo"],
    ["checklistText", "limitChecklistText"],
    ["sessionLocation", "limitSessionLocation"],
    ["sessionAudience", "limitSessionAudience"],
    ["sessionNote", "limitSessionNote"],
    ["materialTitle", "limitMaterialTitle"],
    ["materialBody", "limitMaterialBody"],
    ["materialUrl", "limitMaterialUrl"],
    ["materialMemo", "limitMaterialMemo"],
    ["draftContent", "limitDraftContent"],
    ["draftRequest", "limitDraftRequest"],
    ["draftMaterials", "limitDraftMaterials"],
    ["outputUrl", "limitOutputUrl"],
    ["eventTitle", "limitEventTitle"],
    ["eventNote", "limitEventNote"],
    ["feeAmount", "limitFeeAmount"],
    ["feeLabel", "limitFeeLabel"],
    ["feeMemo", "limitFeeMemo"],
    ["clientName", "limitClientName"],
    ["clientMemo", "limitClientMemo"],
    ["contactName", "limitContactName"],
    ["contactRole", "limitContactRole"],
    ["contactPhone", "limitContactPhone"],
    ["contactMemo", "limitContactMemo"],
    ["cardFileName", "limitCardFileName"],
    ["cardFileBytes", "limitCardFileBytes"],
  ];

  it.each(pairs)("LIMITS.%s == %s()", (key, ruleName) => {
    expect(ruleLimit(ruleName)).toBe(LIMITS[key]);
  });

  it("LIMITS의 모든 값이 규칙에 있다", () => {
    expect(pairs.map(([key]) => key).sort()).toEqual(Object.keys(LIMITS).sort());
  });

  it("첫 관리자 이메일이 코드와 규칙에서 같다", async () => {
    const { BOOTSTRAP_ADMIN_EMAIL } = await import("@/lib/domain/roles");
    expect(rules).toContain(`function bootstrapEmail() { return '${BOOTSTRAP_ADMIN_EMAIL}'; }`);
  });
});
