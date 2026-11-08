"use client";

// 인쇄 화면이 다 그려지면 인쇄 창을 한 번만 자동으로 연다.
// - 글꼴(Noto Sans KR)이 다 내려받아진 뒤에 연다. 아니면 PDF에 대체 글꼴이 찍힐 수 있다 (최대 3초 기다림)
// - 개발 모드(StrictMode)는 effect를 두 번 실행하므로, 실제로 print()를 부른 뒤에만 "열었음"으로 표시한다
// - 화면을 떠나면 예약한 타이머를 치운다

import { useEffect, useRef } from "react";
import { withTimeout } from "@/lib/domain/async";

/** 화면이 그려진 뒤 인쇄 창을 열기까지 기다리는 시간 (레이아웃이 자리 잡게) */
const PRINT_DELAY_MS = 400;
/** 글꼴 내려받기를 기다리는 최대 시간 */
const FONT_WAIT_MS = 3_000;

export function useAutoPrint(ready: boolean): void {
  const printedRef = useRef(false);

  useEffect(() => {
    if (!ready || printedRef.current) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      const fontsReady = document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve();
      withTimeout(fontsReady, FONT_WAIT_MS)
        // 글꼴을 못 기다려도 인쇄 창은 연다 (대체 글꼴이라도 내용은 맞다)
        .catch(() => undefined)
        .then(() => {
          if (cancelled || printedRef.current) return;
          printedRef.current = true;
          window.print();
        });
    }, PRINT_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready]);
}
