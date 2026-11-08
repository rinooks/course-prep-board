// 강의 날짜 옆 "오늘·내일·3일 후" 배지의 글자와 색. 홈·보드·캘린더가 모두 같은 기준을 쓴다.
// 기준: 오늘부터 SESSION_SOON_DAYS(3)일 안이면 warning(주의), 그 밖은 neutral.

import type { BadgeTone } from "@/components/ui/Badge";
import { isDateString, relativeDayLabel, type DateString } from "@/lib/domain/dates";
import { isSessionSoon } from "@/lib/domain/schedule";

export interface DayBadge {
  text: string;
  tone: BadgeTone;
}

/**
 * 날짜가 이상하면 null (배지를 그리지 않는다).
 * inverse면 네이비 타일 위 모양(곧 열리면 흰 바탕 inverseStrong, 아니면 inverse)으로 준다.
 */
export function sessionDayBadge(date: DateString, today: DateString, inverse = false): DayBadge | null {
  if (!isDateString(date) || !isDateString(today)) return null;
  const soon = isSessionSoon(date, today);
  return {
    text: relativeDayLabel(date, today),
    tone: inverse ? (soon ? "inverseStrong" : "inverse") : soon ? "warning" : "neutral",
  };
}
