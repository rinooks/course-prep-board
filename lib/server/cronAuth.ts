// 요청 머리글의 Authorization 확인 (순수 함수, 단위 테스트 대상).
// Vercel Cron은 CRON_SECRET 환경 변수가 있으면 "Authorization: Bearer <CRON_SECRET>"을 붙여 부른다.

import { createHash, timingSafeEqual } from "node:crypto";

/** 너무 짧은 비밀값은 추측당하기 쉬워 받지 않는다 */
export const CRON_SECRET_MIN_LENGTH = 16;

export type CronAuthResult = "ok" | "unauthorized" | "not-configured" | "weak-secret";

/**
 * 두 문자열이 같은지, 걸리는 시간으로 내용을 짐작할 수 없게 비교한다 (constant-time).
 * 길이가 달라도 같은 길이의 해시로 바꿔 비교하므로 길이도 새지 않는다.
 */
export function safeEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a, "utf8").digest();
  const hashB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(hashA, hashB);
}

/** "Bearer abc" → "abc". 형식이 다르면 null */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

/** 크론 요청 확인. secret은 process.env.CRON_SECRET */
export function checkCronAuth(header: string | null | undefined, secret: string | null | undefined): CronAuthResult {
  const value = secret ?? "";
  if (value.trim().length === 0) return "not-configured";
  if (value.trim().length < CRON_SECRET_MIN_LENGTH) return "weak-secret";
  if (!header) return "unauthorized";
  return safeEqual(header, `Bearer ${value}`) ? "ok" : "unauthorized";
}
