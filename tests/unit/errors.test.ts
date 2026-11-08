import { describe, expect, it } from "vitest";
import {
  AppError,
  errorCode,
  fieldErrorsOf,
  isPermissionDenied,
  isPopupClosedError,
  toUserMessage,
} from "@/lib/domain/errors";
import { TimeoutError } from "@/lib/domain/async";

function firebaseLikeError(code: string) {
  return Object.assign(new Error(`Firebase: ${code}`), { code });
}

describe("toUserMessage", () => {
  it("AppError는 자기 문구 그대로", () => {
    expect(toUserMessage(new AppError("x", "직접 쓴 안내입니다."))).toBe("직접 쓴 안내입니다.");
  });

  it("시간 초과는 네트워크 확인 + 다시 시도 안내", () => {
    const message = toUserMessage(new TimeoutError(10_000));
    expect(message).toContain("인터넷 연결");
    expect(message).toContain("다시 시도");
  });

  it("Firestore 권한 오류", () => {
    expect(toUserMessage(firebaseLikeError("permission-denied"))).toContain("권한");
  });

  it("팝업 차단·닫힘·네트워크", () => {
    expect(toUserMessage(firebaseLikeError("auth/popup-blocked"))).toContain("팝업");
    expect(toUserMessage(firebaseLikeError("auth/popup-closed-by-user"))).toContain("다시 눌러");
    expect(toUserMessage(firebaseLikeError("auth/network-request-failed"))).toContain("인터넷");
  });

  it("알 수 없는 오류는 기본 문구 또는 넘겨준 문구 (막연한 '오류가 발생했습니다'는 쓰지 않는다)", () => {
    const message = toUserMessage(new Error("boom"));
    expect(message).not.toBe("오류가 발생했습니다");
    expect(message).toContain("다시 시도");
    expect(toUserMessage("문자열", "직접 정한 안내")).toBe("직접 정한 안내");
  });

  it("모든 안내 문구에 다음 행동이 들어 있다", () => {
    const codes = [
      "timeout",
      "permission-denied",
      "unavailable",
      "not-found",
      "auth/popup-blocked",
      "auth/unauthorized-domain",
      "auth/too-many-requests",
    ];
    for (const code of codes) {
      expect(toUserMessage(firebaseLikeError(code))).toMatch(/주세요|하세요/);
    }
  });
});

describe("판별 함수", () => {
  it("errorCode", () => {
    expect(errorCode(firebaseLikeError("unavailable"))).toBe("unavailable");
    expect(errorCode(new Error("x"))).toBeNull();
    expect(errorCode(null)).toBeNull();
  });

  it("isPopupClosedError / isPermissionDenied", () => {
    expect(isPopupClosedError(firebaseLikeError("auth/popup-closed-by-user"))).toBe(true);
    expect(isPopupClosedError(firebaseLikeError("auth/cancelled-popup-request"))).toBe(true);
    expect(isPopupClosedError(firebaseLikeError("auth/popup-blocked"))).toBe(false);
    expect(isPermissionDenied(firebaseLikeError("permission-denied"))).toBe(true);
  });

  it("fieldErrorsOf", () => {
    expect(fieldErrorsOf(new AppError("invalid-input", "x", { title: "제목" }))).toEqual({ title: "제목" });
    expect(fieldErrorsOf(new Error("x"))).toEqual({});
  });
});
