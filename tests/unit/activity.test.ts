import { describe, expect, it } from "vitest";
import { activityCutoff, ACTIVITY_KEEP_DAYS, formatActivityTime } from "@/lib/domain/activity";

// 한국 시각 2026-10-25 (일) 15:30 = UTC 06:30
const NOW = Date.parse("2026-10-25T06:30:00Z");
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe("최근 활동 시각 표시", () => {
  it("1분 안이거나 서버 시각이 아직 없으면 '방금'", () => {
    expect(formatActivityTime(NOW - 30 * 1000, NOW)).toBe("방금");
    expect(formatActivityTime(null, NOW)).toBe("방금");
  });

  it("오늘이면 분·시간 전", () => {
    expect(formatActivityTime(NOW - 5 * MINUTE, NOW)).toBe("5분 전");
    expect(formatActivityTime(NOW - 3 * HOUR, NOW)).toBe("3시간 전");
  });

  it("한국 날짜로 어제면 '어제 시:분'", () => {
    // 한국 시각 10월 24일 23:50
    expect(formatActivityTime(Date.parse("2026-10-24T14:50:00Z"), NOW)).toBe("어제 23:50");
  });

  it("그 전이면 날짜와 시각", () => {
    expect(formatActivityTime(Date.parse("2026-10-03T00:05:00Z"), NOW)).toBe("10월 3일 (토) 09:05");
  });

  it("오늘 자정 직후는 '시간 전' (UTC로는 어제여도 한국 날짜로 오늘)", () => {
    // 한국 시각 10월 25일 00:10 = UTC 10월 24일 15:10
    expect(formatActivityTime(Date.parse("2026-10-24T15:10:00Z"), NOW)).toBe("15시간 전");
  });
});

describe("보관 기간", () => {
  it(`${ACTIVITY_KEEP_DAYS}일 전보다 앞선 기록을 지운다`, () => {
    const cutoff = activityCutoff(new Date(NOW));
    expect(NOW - cutoff.getTime()).toBe(ACTIVITY_KEEP_DAYS * 24 * HOUR);
  });
});
