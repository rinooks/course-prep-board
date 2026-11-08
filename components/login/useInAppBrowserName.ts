"use client";

import { useSyncExternalStore } from "react";
import { detectInAppBrowser } from "./inAppBrowser";

// 브라우저 종류는 화면을 보는 동안 바뀌지 않으므로 구독할 것이 없다
function subscribeNothing(): () => void {
  return () => {};
}

function getSnapshot(): string | null {
  return detectInAppBrowser(navigator.userAgent);
}

// 서버에서는 알 수 없으니 "아님"으로 그리고, 브라우저에서 다시 그릴 때 실제 값으로 바뀐다
function getServerSnapshot(): string | null {
  return null;
}

/** 카카오톡 등 앱 안 브라우저라면 그 앱 이름 */
export function useInAppBrowserName(): string | null {
  return useSyncExternalStore(subscribeNothing, getSnapshot, getServerSnapshot);
}
