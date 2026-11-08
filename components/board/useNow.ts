"use client";

import { useEffect, useState } from "react";

const TICK_MS = 60_000;

/**
 * 지금 시각(밀리초). 1분마다 바뀌어 "5분 전" 같은 표시가 저절로 갱신된다.
 * 화면을 떠나면 타이머를 치운다.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
}
