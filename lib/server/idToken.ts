// 브라우저가 보낸 Firebase 로그인 증표(ID 토큰)를 구글 로그인 서버(Identity Toolkit accounts:lookup)에 물어 확인한다.
// 구글 쪽에서 서명·만료·프로젝트를 확인하고, 통과하면 그 계정의 이메일과 이메일 인증 여부를 돌려준다.
//
// firebase-admin/auth의 verifyIdToken을 쓰지 않는 이유 (2026-10-12):
// 그 안의 jwks-rsa가 ESM 전용인 jose를 require()로 불러, Vercel 서버에서 불러오기 오류(ERR_REQUIRE_ESM)가 났다.
// 이 방식은 새 패키지 없이 fetch 한 번으로 끝난다. API 키는 원래 브라우저에도 내려가는 공개용 웹 설정값이다.

import { RequestError, ServerSetupError } from "./errors";

const LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

/** 구글 로그인 서버 응답을 기다리는 최대 시간 */
export const ID_TOKEN_LOOKUP_TIMEOUT_MS = 8_000;

/** 토큰이 만료됐거나 다른 프로젝트 것이거나 계정이 막힌 경우 구글이 돌려주는 오류 이름 */
const REJECTED_TOKEN_ERRORS = ["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND", "USER_DISABLED"];

const SIGN_IN_AGAIN_MESSAGE = "로그인 정보가 만료되었거나 올바르지 않습니다. 화면을 새로고침한 뒤 다시 눌러 주세요.";

export interface VerifiedIdentity {
  /** 소문자 이메일. 없으면 빈 문자열 */
  email: string;
  emailVerified: boolean;
}

export interface LookupOptions {
  /** Firebase 웹 API 키 (NEXT_PUBLIC_FIREBASE_API_KEY) */
  apiKey: string | undefined;
  /** API 키에 웹사이트 제한이 걸려 있어도 통과하도록 우리 앱 주소를 Referer로 보낸다 */
  referer?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function readErrorName(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : "";
}

/** ID 토큰 확인. 통과하면 이메일과 인증 여부, 아니면 RequestError(401/502/503) */
export async function lookupIdToken(idToken: string, options: LookupOptions): Promise<VerifiedIdentity> {
  const apiKey = (options.apiKey ?? "").trim();
  if (!apiKey) {
    throw new ServerSetupError(
      "api-key-missing",
      "서버에 NEXT_PUBLIC_FIREBASE_API_KEY가 없어 로그인을 확인하지 못했습니다. Vercel 환경 변수를 확인해 주세요.",
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? ID_TOKEN_LOOKUP_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(`${LOOKUP_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.referer ? { Referer: options.referer } : {}),
      },
      body: JSON.stringify({ idToken }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new RequestError(503, "로그인 확인 서버에 연결하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const name = readErrorName(body);
    if (REJECTED_TOKEN_ERRORS.some((code) => name.startsWith(code))) {
      throw new RequestError(401, SIGN_IN_AGAIN_MESSAGE);
    }
    throw new RequestError(502, "로그인 확인 서버가 응답하지 않았습니다. 잠시 뒤 다시 눌러 주세요.");
  }

  const users = (body as { users?: unknown } | null)?.users;
  const user = Array.isArray(users) ? (users[0] as { email?: unknown; emailVerified?: unknown } | undefined) : undefined;
  if (!user) throw new RequestError(401, SIGN_IN_AGAIN_MESSAGE);

  return {
    email: typeof user.email === "string" ? user.email.trim().toLowerCase() : "",
    emailVerified: user.emailVerified === true,
  };
}
