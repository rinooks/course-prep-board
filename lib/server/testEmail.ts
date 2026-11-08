import "server-only";

// 관리자 화면의 "나에게 테스트 메일 보내기" (app/api/notify/test가 부른다).
// 1) 브라우저가 보낸 Firebase 로그인 증표(ID 토큰)를 구글 로그인 서버에 물어 확인한다 (lib/server/idToken.ts) — 이름·이메일은 요청 본문이 아니라 토큰에서만 읽는다
// 2) 이메일 인증이 끝난 계정이고, members 문서의 역할이 관리자(또는 첫 관리자)인지 본다
// 3) 1분에 한 번만 (서버 한 대 안에서 센다), 그 관리자 자신의 주소로만 보낸다

import { READ_TIMEOUT_MS, withTimeout } from "@/lib/domain/async";
import { todayInSeoul } from "@/lib/domain/dates";
import { buildTestEmail, resolveAppUrl } from "@/lib/domain/digest";
import { isBootstrapAdmin } from "@/lib/domain/roles";
import { RequestError } from "./errors";
import { adminDb } from "./firebaseAdmin";
import { lookupIdToken } from "./idToken";
import { createMailer } from "./mailer";
import { memberFromData } from "./records";
import { createThrottle } from "./requestGuards";

export const TEST_MAIL_INTERVAL_MS = 60_000;

const throttle = createThrottle(TEST_MAIL_INTERVAL_MS);

export async function sendTestEmail(idToken: string, now: Date = new Date()): Promise<{ to: string }> {
  const identity = await lookupIdToken(idToken, {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    referer: `${resolveAppUrl(process.env.APP_BASE_URL)}/`,
  });
  const email = identity.email;
  if (!email || !identity.emailVerified) {
    throw new RequestError(
      403,
      "이메일 인증이 끝난 구글 계정으로 로그인해야 합니다. 로그아웃한 뒤 다시 로그인해 주세요.",
    );
  }

  const snapshot = await withTimeout(adminDb().collection("members").doc(email).get(), READ_TIMEOUT_MS);
  const member = snapshot.exists ? memberFromData(snapshot.id, snapshot.data() ?? {}) : null;
  if (!isBootstrapAdmin(email) && member?.role !== "admin") {
    throw new RequestError(403, "관리자만 테스트 메일을 보낼 수 있습니다. 필요하면 관리자에게 요청해 주세요.");
  }

  const slot = throttle.take(email, now.getTime());
  if (!slot.ok) {
    const seconds = Math.ceil(slot.retryAfterMs / 1000);
    throw new RequestError(429, `테스트 메일은 1분에 한 번만 보낼 수 있습니다. ${seconds}초 뒤에 다시 눌러 주세요.`);
  }

  const name = member && member.displayName.trim().length > 0 ? member.displayName.trim() : email;
  const mail = buildTestEmail({ to: email, name, today: todayInSeoul(now), appUrl: process.env.APP_BASE_URL });

  try {
    const mailer = createMailer();
    try {
      await mailer.send(mail);
    } finally {
      mailer.close();
    }
  } catch (error) {
    // 설정을 고친 뒤 바로 다시 눌러 볼 수 있게 횟수 기록을 지운다
    throttle.release(email);
    throw error;
  }
  return { to: email };
}
