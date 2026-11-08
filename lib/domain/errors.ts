// 오류를 사용자에게 보여줄 한국어 문구로 바꾼다.
// 규칙: "오류가 발생했습니다"로 끝내지 않고, 사용자가 다음에 할 일을 적는다.
// Firebase를 직접 import하지 않고 error.code 문자열만 본다.

import type { FieldErrors } from "./validation";

/** 우리 앱이 직접 던지는 오류. message가 곧 사용자에게 보여줄 문구다. */
export class AppError extends Error {
  readonly code: string;
  readonly fieldErrors?: FieldErrors;

  constructor(code: string, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** error.code를 꺼낸다. Firestore는 "permission-denied", Auth는 "auth/popup-blocked" 형태다. */
export function errorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

const KEEP_INPUT = "입력한 내용은 그대로 있습니다.";

const MESSAGES: Record<string, string> = {
  // 우리 앱
  timeout: `저장이 확인되지 않았습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. ${KEEP_INPUT}`,
  "signed-out": "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.",
  "firebase-not-configured":
    "앱 설정값(Firebase)이 비어 있어 연결할 수 없습니다. 관리자에게 배포 설정을 확인해 달라고 알려 주세요.",

  // Firestore
  "permission-denied":
    "이 작업을 할 권한이 없습니다. 초대가 취소되었거나 관리자 전용 작업일 수 있으니, 새로고침한 뒤에도 같으면 관리자에게 문의해 주세요.",
  unauthenticated: "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.",
  unavailable: `서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. ${KEEP_INPUT}`,
  "deadline-exceeded": `응답이 너무 늦습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. ${KEEP_INPUT}`,
  "resource-exhausted": "요청이 한꺼번에 너무 많습니다. 1분쯤 기다렸다가 다시 시도해 주세요.",
  "not-found": "찾는 항목이 없습니다. 다른 사람이 지웠을 수 있으니 화면을 새로고침해 주세요.",
  "already-exists": "같은 항목이 이미 있습니다. 화면을 새로고침해서 확인해 주세요.",
  aborted: "다른 사람이 같은 항목을 동시에 바꿨습니다. 화면을 확인한 뒤 다시 시도해 주세요.",
  "failed-precondition": "지금 상태에서는 할 수 없는 작업입니다. 화면을 새로고침한 뒤 다시 시도해 주세요.",
  "invalid-argument": "입력값이 올바르지 않습니다. 빨간 안내가 있는 칸을 고친 뒤 다시 시도해 주세요.",
  cancelled: "작업이 취소되었습니다. 다시 시도해 주세요.",

  // Storage (카드 첨부 파일). 코드 앞에 "storage/"가 붙는다
  "storage/unauthorized":
    "이 파일을 올리거나 열 권한이 없습니다. 초대가 취소되었거나 과정이 휴지통에 있을 수 있으니, 새로고침한 뒤에도 같으면 관리자에게 문의해 주세요.",
  "storage/unauthenticated": "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.",
  "storage/retry-limit-exceeded": "인터넷 연결이 불안정해 파일을 올리지 못했습니다. 연결을 확인한 뒤 다시 올려 주세요.",
  "storage/quota-exceeded": "파일 저장 공간이 가득 찼습니다. 관리자에게 알려 주세요.",
  "storage/object-not-found": "파일을 찾을 수 없습니다. 다른 사람이 지웠을 수 있으니 화면을 새로고침해 주세요.",
  "storage/canceled": "파일 올리기를 멈췄습니다. 다시 올리려면 '다시 올리기'를 눌러 주세요.",
  "storage/server-file-wrong-size": "파일이 올라가는 도중 손상되었습니다. 다시 올려 주세요.",
  "storage/invalid-checksum": "파일이 올라가는 도중 손상되었습니다. 다시 올려 주세요.",
  "storage/bucket-not-found": "파일 저장소를 찾을 수 없습니다. 관리자에게 배포 설정(파일 저장소 주소)을 확인해 달라고 알려 주세요.",
  "storage/no-default-bucket": "파일 저장소 설정값이 비어 있습니다. 관리자에게 배포 설정(파일 저장소 주소)을 확인해 달라고 알려 주세요.",

  // Auth (구글 로그인)
  "auth/popup-blocked":
    "브라우저가 로그인 창을 막았습니다. 주소창 오른쪽의 팝업 차단 아이콘을 눌러 이 사이트를 허용한 뒤 다시 로그인해 주세요.",
  "auth/popup-closed-by-user": "로그인 창이 닫혔습니다. 로그인하려면 버튼을 다시 눌러 주세요.",
  "auth/cancelled-popup-request": "로그인 창이 닫혔습니다. 로그인하려면 버튼을 다시 눌러 주세요.",
  "auth/user-cancelled": "로그인을 취소했습니다. 로그인하려면 버튼을 다시 눌러 주세요.",
  "auth/network-request-failed": "인터넷 연결이 불안정해 로그인하지 못했습니다. 연결을 확인한 뒤 다시 로그인해 주세요.",
  "auth/too-many-requests": "로그인 시도가 너무 많습니다. 몇 분 뒤에 다시 시도해 주세요.",
  "auth/unauthorized-domain":
    "이 주소에서는 로그인할 수 없도록 설정되어 있습니다. 관리자에게 접속한 주소를 알려 주세요.",
  "auth/operation-not-allowed": "구글 로그인이 꺼져 있습니다. 관리자에게 Firebase 로그인 설정을 확인해 달라고 알려 주세요.",
  "auth/user-disabled": "사용이 중지된 계정입니다. 관리자에게 문의해 주세요.",
  "auth/internal-error": "로그인 중 문제가 생겼습니다. 페이지를 새로고침한 뒤 다시 로그인해 주세요.",
  "auth/web-storage-unsupported":
    "브라우저 설정 때문에 로그인 정보를 저장할 수 없습니다. 시크릿 모드를 끄거나 쿠키·사이트 데이터를 허용한 뒤 다시 시도해 주세요.",
};

const DEFAULT_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주시고, 계속되면 페이지를 새로고침해 주세요.";

/**
 * 어떤 오류든 화면에 보여줄 한국어 문구로 바꾼다.
 * fallback을 주면 알 수 없는 오류일 때 그 문구를 쓴다.
 */
export function toUserMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (isAppError(error)) return error.message;

  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return MESSAGES.unavailable;
  }
  return fallback;
}

/** 사용자가 스스로 로그인 창을 닫은 경우. 빨간 오류 대신 가벼운 안내로 보여주면 된다. */
export function isPopupClosedError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  );
}

export function isPermissionDenied(error: unknown): boolean {
  return errorCode(error) === "permission-denied";
}

/** 입력값 검증 오류의 칸별 메시지 (없으면 빈 객체) */
export function fieldErrorsOf(error: unknown): FieldErrors {
  return isAppError(error) && error.fieldErrors ? error.fieldErrors : {};
}
