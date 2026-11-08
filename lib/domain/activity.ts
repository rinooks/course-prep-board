// 최근 활동(PRD F9): 보여 줄 개수, 보관 기간, 시각 표시. 순수 함수.
// 기록은 서버 함수(functions/)가 남기고, 매일 아침 알림 작업(lib/server/dailyJob.ts)이 오래된 것을 지운다.

import { formatDateKo, todayInSeoul } from "./dates";

/** 과정 보드 위쪽에 보이는 개수 */
export const RECENT_ACTIVITY_COUNT = 5;

/** 이 날수보다 오래된 기록은 지운다 (끝없이 쌓이지 않게) */
export const ACTIVITY_KEEP_DAYS = 90;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// 한국 시각 = UTC + 9시간 (서머타임 없음)
const SEOUL_OFFSET_MS = 9 * HOUR;

/** 이 시각보다 앞선 기록을 지운다 */
export function activityCutoff(now: Date): Date {
  return new Date(now.getTime() - ACTIVITY_KEEP_DAYS * DAY);
}

/** 한국 시각 "14:05" */
function seoulClock(ms: number): string {
  const date = new Date(ms + SEOUL_OFFSET_MS);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 기록 시각을 읽기 쉽게: "방금", "5분 전", "3시간 전"(오늘), "어제 14:05", "10월 3일 (금) 14:05".
 * 서버 시각이 아직 없으면(방금 쓴 기록) "방금".
 */
export function formatActivityTime(ms: number | null, now: number): string {
  if (ms === null) return "방금";
  const diff = now - ms;
  if (diff < MINUTE) return "방금";

  const today = todayInSeoul(new Date(now));
  const day = todayInSeoul(new Date(ms));
  if (day === today) {
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
    return `${Math.floor(diff / HOUR)}시간 전`;
  }
  if (day === todayInSeoul(new Date(now - DAY))) return `어제 ${seoulClock(ms)}`;
  return `${formatDateKo(day)} ${seoulClock(ms)}`;
}
