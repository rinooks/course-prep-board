// FIREBASE_SERVICE_ACCOUNT 환경 변수 읽기 (순수 함수, 단위 테스트 대상).
// Firebase 콘솔에서 내려받은 키 JSON을 그대로 붙여 넣거나, 그 JSON을 base64로 바꾼 값을 받는다.
// 오류 문구에 값(비밀키)을 절대 넣지 않는다.

import { ServerSetupError } from "./errors";

export interface ParsedServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const MISSING_MESSAGE =
  "FIREBASE_SERVICE_ACCOUNT 환경 변수가 비어 있습니다. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정에서 새 비공개 키(JSON)를 만들어 Vercel 환경 변수에 넣고 다시 배포해 주세요.";
const INVALID_MESSAGE =
  "FIREBASE_SERVICE_ACCOUNT 값을 읽지 못했습니다. 내려받은 키 JSON 파일 내용을 처음 { 부터 마지막 } 까지 빠짐없이 붙여 넣었는지 확인해 주세요.";
const FIELDS_MESSAGE =
  "FIREBASE_SERVICE_ACCOUNT에 project_id, client_email, private_key 중 빠진 값이 있습니다. Firebase 콘솔에서 키를 새로 내려받아 다시 넣어 주세요.";

function decode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  // base64로 넣은 경우
  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
  if (decoded.startsWith("{")) return decoded;
  throw new ServerSetupError("service-account-invalid", INVALID_MESSAGE);
}

function readString(data: Record<string, unknown>, snake: string, camel: string): string {
  const value = data[snake] ?? data[camel];
  return typeof value === "string" ? value.trim() : "";
}

export function parseServiceAccount(raw: string | null | undefined): ParsedServiceAccount {
  if (!raw || raw.trim().length === 0) {
    throw new ServerSetupError("service-account-missing", MISSING_MESSAGE);
  }

  let data: unknown;
  try {
    data = JSON.parse(decode(raw));
  } catch (error) {
    if (error instanceof ServerSetupError) throw error;
    throw new ServerSetupError("service-account-invalid", INVALID_MESSAGE);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ServerSetupError("service-account-invalid", INVALID_MESSAGE);
  }

  const record = data as Record<string, unknown>;
  const projectId = readString(record, "project_id", "projectId");
  const clientEmail = readString(record, "client_email", "clientEmail");
  // 줄바꿈이 "\n" 글자 그대로 들어온 경우(한 줄로 붙여 넣기) 실제 줄바꿈으로 되돌린다
  const privateKey = readString(record, "private_key", "privateKey").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey.includes("PRIVATE KEY")) {
    throw new ServerSetupError("service-account-fields", FIELDS_MESSAGE);
  }
  return { projectId, clientEmail, privateKey };
}
