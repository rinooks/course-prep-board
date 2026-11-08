import { describe, expect, it } from "vitest";
import { ID_LENGTH, createId, isSafeId } from "@/lib/domain/ids";
import { isImeComposing, isSubmitEnter } from "@/components/ui/ime";
import { BOOTSTRAP_ADMIN_EMAIL, isBootstrapAdmin, isRole, roleLabel } from "@/lib/domain/roles";

describe("createId", () => {
  it("영문·숫자 20자, 겹치지 않는다", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => createId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
      expect(isSafeId(id)).toBe(true);
    }
    expect(createId(5)).toHaveLength(5);
    expect(ID_LENGTH).toBe(20);
  });

  it("isSafeId", () => {
    expect(isSafeId("abc_DEF-123")).toBe(true);
    expect(isSafeId("a/b")).toBe(false);
    expect(isSafeId("")).toBe(false);
    expect(isSafeId("a".repeat(129))).toBe(false);
  });
});

describe("한글 입력 중 Enter", () => {
  it("조합 중이면 전송하지 않는다", () => {
    expect(isImeComposing({ key: "Enter", isComposing: true })).toBe(true);
    expect(isImeComposing({ key: "Enter", nativeEvent: { isComposing: true } })).toBe(true);
    expect(isImeComposing({ key: "Enter", keyCode: 229 })).toBe(true);
    expect(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: true } })).toBe(false);
  });

  it("일반 Enter만 전송, Shift+Enter는 줄바꿈", () => {
    expect(isSubmitEnter({ key: "Enter", keyCode: 13 })).toBe(true);
    expect(isSubmitEnter({ key: "Enter", shiftKey: true })).toBe(false);
    expect(isSubmitEnter({ key: "Enter", shiftKey: true }, { allowShift: true })).toBe(true);
    expect(isSubmitEnter({ key: "a" })).toBe(false);
  });
});

describe("역할", () => {
  it("첫 관리자 판별은 대소문자·공백 무시", () => {
    expect(isBootstrapAdmin(` ${BOOTSTRAP_ADMIN_EMAIL.toUpperCase()} `)).toBe(true);
    expect(isBootstrapAdmin("other@gmail.com")).toBe(false);
    expect(isBootstrapAdmin(null)).toBe(false);
  });

  it("isRole / roleLabel", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(roleLabel("instructor")).toBe("강사");
  });
});
