// 매일 아침 알림 메일 (Vercel Cron이 vercel.json의 일정대로 부른다: 매일 00:00 UTC = 한국 09:00).
// Vercel은 CRON_SECRET 환경 변수가 있으면 "Authorization: Bearer <CRON_SECRET>"을 붙여 부른다.
// 머리글을 읽으므로 미리 만들어 두지 않고(사전 렌더링 없이) 요청이 올 때마다 실행된다.

import type { NextRequest } from "next/server";
import { checkCronAuth, CRON_SECRET_MIN_LENGTH } from "@/lib/server/cronAuth";
import { runDailyJob } from "@/lib/server/dailyJob";
import { describeForLog, toHttpError } from "@/lib/server/errors";
import { jsonResponse } from "@/lib/server/requestGuards";

/** 초 단위. 팀원 20명 기준으로 넉넉하다 */
export const maxDuration = 60;

const NOT_CONFIGURED_MESSAGE =
  "CRON_SECRET 환경 변수가 비어 있어 알림 메일 작업을 실행하지 않았습니다. Vercel → Settings → Environment Variables에 CRON_SECRET을 넣고 다시 배포해 주세요.";
const WEAK_SECRET_MESSAGE = `CRON_SECRET이 너무 짧습니다. ${CRON_SECRET_MIN_LENGTH}자 이상의 무작위 값으로 바꾼 뒤 다시 배포해 주세요.`;

export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "not-configured") return jsonResponse(500, { ok: false, error: NOT_CONFIGURED_MESSAGE });
  if (auth === "weak-secret") return jsonResponse(500, { ok: false, error: WEAK_SECRET_MESSAGE });
  if (auth === "unauthorized") return jsonResponse(401, { ok: false, error: "인증되지 않은 요청입니다." });

  try {
    const summary = await runDailyJob();
    // 개수만 남긴다 (받는 사람 주소 없음)
    console.info("[cron/daily] 완료", JSON.stringify(summary));
    return jsonResponse(200, { ok: true, ...summary });
  } catch (error) {
    console.error("[cron/daily] 실패:", describeForLog(error));
    const { status, message } = toHttpError(error);
    return jsonResponse(status, { ok: false, error: message });
  }
}
