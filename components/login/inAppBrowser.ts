// 카카오톡처럼 앱 안에서 열리는 브라우저를 알아낸다.
// 구글은 이런 화면(웹뷰)에서 로그인을 막는다(disallowed_useragent). 로그인 화면에서 미리 안내하려고 쓴다.

interface InAppBrowserRule {
  pattern: RegExp;
  name: string;
}

const IN_APP_BROWSERS: readonly InAppBrowserRule[] = [
  { pattern: /KAKAOTALK/i, name: "카카오톡" },
  { pattern: /NAVER\(inapp/i, name: "네이버 앱" },
  { pattern: /DaumApps/i, name: "다음 앱" },
  { pattern: /\bLine\//, name: "라인" },
  { pattern: /Instagram/i, name: "인스타그램" },
  { pattern: /FBAN|FBAV|FB_IAB/, name: "페이스북" },
  { pattern: /\bBAND\//, name: "밴드" },
];

/** 앱 안 브라우저면 그 앱 이름, 아니면 null */
export function detectInAppBrowser(userAgent: string): string | null {
  const rule = IN_APP_BROWSERS.find((item) => item.pattern.test(userAgent));
  return rule ? rule.name : null;
}
