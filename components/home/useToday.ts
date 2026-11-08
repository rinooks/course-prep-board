"use client";

import { useSyncExternalStore } from "react";
import { todayInSeoul, type DateString } from "@/lib/domain/dates";
import { msUntilNextSeoulMidnight } from "./today";

// 자정을 넘기면 조금 여유를 두고 다시 확인한다 (타이머가 몇 ms 일찍 깨는 경우 대비)
const MIDNIGHT_MARGIN_MS = 1000;

/** 한국 자정이 지나거나 탭으로 돌아올 때 onChange를 부른다. 해제 함수를 돌려준다. */
function subscribeToDayChange(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, msUntilNextSeoulMidnight(Date.now()) + MIDNIGHT_MARGIN_MS);
  };

  // 노트북을 덮어 두면 타이머가 늦게 깨므로, 화면으로 돌아올 때도 날짜를 다시 본다
  const handleVisibility = () => {
    if (document.visibilityState === "visible") onChange();
  };

  schedule();
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

function getServerToday(): DateString | null {
  return null;
}

/**
 * 오늘 한국 날짜("YYYY-MM-DD"). 자정을 넘기면 저절로 바뀐다.
 * 서버에서 미리 그릴 때는 현재 시각을 읽지 않고 null을 준다 (cacheComponents 규칙).
 */
export function useToday(): DateString | null {
  return useSyncExternalStore(subscribeToDayChange, todayInSeoul, getServerToday);
}
