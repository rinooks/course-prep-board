import { describe, expect, it } from "vitest";
import { detectInAppBrowser } from "./inAppBrowser";

describe("앱 안 브라우저 알아내기", () => {
  it("카카오톡 (안드로이드·아이폰)", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13; SM-S918N Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410200",
      ),
    ).toBe("카카오톡");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0",
      ),
    ).toBe("카카오톡");
  });

  it("네이버·인스타그램·페이스북·라인·밴드", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 NAVER(inapp; search; 2000; 12.1.5)")).toBe(
      "네이버 앱",
    );
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0.0.0")).toBe("인스타그램");
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 [FBAN/FBIOS;FBAV/430.0.0]")).toBe("페이스북");
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/13.18.0")).toBe("라인");
    expect(detectInAppBrowser("Mozilla/5.0 (Linux; Android 13; wv) Chrome/116.0 Mobile BAND/16.1.2")).toBe("밴드");
  });

  it("일반 브라우저는 아니다", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      ),
    ).toBeNull();
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBeNull();
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
      ),
    ).toBeNull();
    expect(detectInAppBrowser("")).toBeNull();
  });
});
