// 서버(알림 메일) 오류를 사용자에게 보여 줄 한국어 문구와 HTTP 상태로 바꾼다.
// 규칙: 비밀값·받는 사람 주소를 문구와 기록(로그)에 넣지 않는다. 문구에는 무엇을 고치면 되는지 적는다.
// "server-only"를 넣지 않은 순수 파일이라 단위 테스트에서 바로 부른다 (tests/unit/notify-server.test.ts).

/** 환경 변수가 비었거나 잘못된 경우. 관리자가 Vercel 설정을 고쳐야 한다 */
export class ServerSetupError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServerSetupError";
    this.code = code;
  }
}

/** 요청이 잘못된 경우 (권한 없음, 너무 잦은 요청 등). message를 그대로 돌려준다 */
export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

/** error.code (문자열 또는 숫자). 없으면 null */
export function errorCodeOf(error: unknown): string | number | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return code;
  }
  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

const EMAIL_IN_TEXT = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g;

/** 기록용 한 줄: 오류 이름·코드와 이메일 주소를 가린 메시지 (200자까지) */
export function describeForLog(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  const code = errorCodeOf(error);
  const message = messageOf(error).replace(EMAIL_IN_TEXT, "<email>").slice(0, 200);
  return [name, code === null ? null : `code=${code}`, message].filter(Boolean).join(" ");
}

const MAIL_AUTH_MESSAGE =
  "Gmail 로그인에 실패했습니다. Vercel 환경 변수의 GMAIL_USER(보내는 Gmail 주소)와 GMAIL_APP_PASSWORD(구글 앱 비밀번호 16자리)를 확인한 뒤 다시 배포해 주세요.";
const MAIL_CONNECTION_MESSAGE = "Gmail 서버에 연결하지 못했습니다. 몇 분 뒤 다시 시도해 주세요.";
const MAIL_DEFAULT_MESSAGE = "메일을 보내지 못했습니다. 몇 분 뒤 다시 시도하고, 계속되면 Vercel 로그를 확인해 주세요.";

/** nodemailer 오류 코드: https://nodemailer.com (dist/esm/errors.d.ts의 ERROR_CODES) */
const MAIL_CODES: Record<string, string> = {
  EAUTH: MAIL_AUTH_MESSAGE,
  ENOAUTH: MAIL_AUTH_MESSAGE,
  ECONNECTION: MAIL_CONNECTION_MESSAGE,
  ETIMEDOUT: MAIL_CONNECTION_MESSAGE,
  ESOCKET: MAIL_CONNECTION_MESSAGE,
  EDNS: MAIL_CONNECTION_MESSAGE,
  ETLS: MAIL_CONNECTION_MESSAGE,
  timeout: MAIL_CONNECTION_MESSAGE,
  EENVELOPE: "받는 사람 주소가 올바르지 않아 메일을 보내지 못했습니다. 팀원 이메일을 확인해 주세요.",
  EMESSAGE:
    "Gmail이 메일을 받지 않았습니다. 하루 보내기 한도를 넘었을 수 있으니 내일 다시 시도해 주세요.",
};

export function isMailError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return typeof code === "string" && code in MAIL_CODES;
}

export function describeMailError(error: unknown): string {
  const code = errorCodeOf(error);
  if (typeof code === "string" && MAIL_CODES[code]) return MAIL_CODES[code];
  return MAIL_DEFAULT_MESSAGE;
}

const KEY_PROBLEM_MESSAGE =
  "서비스 계정 키가 올바르지 않거나 삭제되었습니다. Firebase 콘솔에서 새 비공개 키를 만들어 Vercel의 FIREBASE_SERVICE_ACCOUNT를 바꾼 뒤 다시 배포해 주세요.";

/** Firestore(서버용) 오류. gRPC 상태 번호: 4 시간 초과, 7 권한 없음, 14 연결 안 됨, 16 인증 실패 */
export function describeAdminError(error: unknown): { status: number; message: string } {
  const code = errorCodeOf(error);
  const message = messageOf(error);
  if (code === 7 || code === "permission-denied") {
    return {
      status: 500,
      message:
        "서비스 계정이 Firestore를 읽을 권한이 없습니다. FIREBASE_SERVICE_ACCOUNT에 edu-project-f1d12 프로젝트의 키를 넣었는지 확인해 주세요.",
    };
  }
  if (code === 16 || /invalid_grant|private key|DECODER|PEM/i.test(message)) {
    return { status: 500, message: KEY_PROBLEM_MESSAGE };
  }
  if (code === 4 || code === 14 || code === "timeout") {
    return { status: 503, message: "Firestore 응답이 늦습니다. 몇 분 뒤 다시 시도해 주세요." };
  }
  return {
    status: 500,
    message: "알림 작업을 마치지 못했습니다. 몇 분 뒤 다시 시도하고, 계속되면 Vercel 로그(Functions)를 확인해 주세요.",
  };
}

const AUTH_MESSAGES: Record<string, string> = {
  "auth/id-token-expired": "로그인 정보가 만료되었습니다. 페이지를 새로고침한 뒤 다시 눌러 주세요.",
  "auth/id-token-revoked": "로그인이 풀렸습니다. 로그아웃한 뒤 다시 로그인해 주세요.",
  "auth/user-disabled": "사용이 중지된 계정입니다. Firebase 콘솔의 Authentication에서 계정 상태를 확인해 주세요.",
};

const AUTH_DEFAULT_MESSAGE =
  "로그인 정보를 확인하지 못했습니다. 로그아웃 후 다시 로그인해 주세요. 계속되면 FIREBASE_SERVICE_ACCOUNT가 edu-project-f1d12 프로젝트의 키인지 확인해 주세요.";

/** 어떤 오류든 HTTP 상태와 한국어 문구로 */
export function toHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof RequestError) return { status: error.status, message: error.message };
  if (error instanceof ServerSetupError) return { status: 500, message: error.message };
  if (isMailError(error)) return { status: 502, message: describeMailError(error) };
  const code = errorCodeOf(error);
  if (typeof code === "string" && code.startsWith("auth/")) {
    return { status: 401, message: AUTH_MESSAGES[code] ?? AUTH_DEFAULT_MESSAGE };
  }
  return describeAdminError(error);
}
