"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(timer);
}

// 1분 단위로 내림해서, 같은 분 안에서는 같은 값을 돌려준다 (불필요한 다시 그리기 방지)
function getSnapshot(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

// 서버에서 그릴 때는 시각을 모른다. 화면이 브라우저에서 다시 그려지며 실제 값으로 바뀐다.
function getServerSnapshot(): number {
  return 0;
}

/** 지금 시각(밀리초, 분 단위). "오늘·어제" 표시가 자정을 넘으면 저절로 바뀌게 한다. */
export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
