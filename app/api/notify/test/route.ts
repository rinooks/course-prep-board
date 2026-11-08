// 관리자 화면의 "나에게 테스트 메일 보내기".
// 요청: POST, 머리글 "Authorization: Bearer <Firebase ID 토큰>" (본문 없음).
// 우리 사이트 화면에서 온 요청만 받는다 (Origin 확인). 실제 확인·보내기는 lib/server/testEmail.ts.

import type { NextRequest } from "next/server";
import { resolveAppUrl } from "@/lib/domain/digest";
import { bearerToken } from "@/lib/server/cronAuth";
import { describeForLog, toHttpError } from "@/lib/server/errors";
import { isAllowedOrigin, jsonResponse } from "@/lib/server/requestGuards";
import { sendTestEmail } from "@/lib/server/testEmail";

export const maxDuration = 30;

/** ID 토큰은 1KB 안팎이다. 이보다 길면 잘못된 요청으로 본다 */
const MAX_TOKEN_LENGTH = 4096;

export async function POST(request: NextRequest) {
  const allowed = isAllowedOrigin(request.headers.get("origin"), request.headers.get("host"), [
    resolveAppUrl(process.env.APP_BASE_URL),
  ]);
  if (!allowed) {
    return jsonResponse(403, {
      ok: false,
      error: "강의 준비 보드 화면에서 보낸 요청만 받습니다. 관리자 화면을 새로고침한 뒤 다시 눌러 주세요.",
    });
  }

  const token = bearerToken(request.headers.get("authorization"));
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return jsonResponse(401, { ok: false, error: "로그인 정보가 없습니다. 다시 로그인한 뒤 눌러 주세요." });
  }

  try {
    const { to } = await sendTestEmail(token);
    return jsonResponse(200, {
      ok: true,
      message: `${to} 주소로 테스트 메일을 보냈습니다. 1~2분 안에 받은편지함(없으면 스팸함)을 확인해 주세요.`,
    });
  } catch (error) {
    console.error("[notify/test] 실패:", describeForLog(error));
    const { status, message } = toHttpError(error);
    return jsonResponse(status, { ok: false, error: message });
  }
}
