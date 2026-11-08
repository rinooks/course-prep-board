// 입력값 정리·검증. 화면에서 바로 쓰는 한국어 안내 문구를 돌려준다.
// 길이 제한(LIMITS)은 firestore.rules의 limit*() 함수와 같아야 한다.
// tests/unit/validation.test.ts가 두 값이 어긋나지 않았는지 검사한다.

import { CARD_FILE_MAX_BYTES, CARD_FILE_NAME_MAX } from "./cardFiles";
import { isPhoneValue } from "./clients";
import { isDateString, isTimeString } from "./dates";
import { isDraftKind, type DraftKind } from "./drafts";
import { isEventKind, type EventKind } from "./events";
import { FEE_AMOUNT_MAX, formatWon, parseWon } from "./fees";
import { hasTextBody, isHttpUrl, isMaterialKind, type MaterialKind } from "./materials";
import { isStageId, type StageId } from "./stages";
import { isRole, type Role } from "./roles";

export const LIMITS = {
  email: 254,
  displayName: 100,
  photoURL: 2048,
  courseTitle: 100,
  courseClient: 100,
  courseDescription: 2000,
  instructors: 20,
  cardTitle: 200,
  cardMemo: 5000,
  checklistText: 300,
  sessionLocation: 200,
  sessionAudience: 200,
  sessionNote: 1000,
  // 재료·초안 글은 Firestore 문서 하나(최대 1MB)에 들어가야 한다. 한글 10만 자 ≈ 300KB
  materialTitle: 200,
  materialBody: 100000,
  materialUrl: 2048,
  materialMemo: 2000,
  draftContent: 100000,
  draftRequest: 2000,
  draftMaterials: 50,
  outputUrl: 2048,
  eventTitle: 200,
  eventNote: 1000,
  // 강사료: 금액은 글자 수가 아니라 원 단위 최댓값
  feeAmount: FEE_AMOUNT_MAX,
  feeLabel: 100,
  feeMemo: 1000,
  // 고객사 이름은 과정의 고객사 칸(courseClient)과 같은 길이까지
  clientName: 100,
  clientMemo: 2000,
  contactName: 100,
  contactRole: 100,
  contactPhone: 30,
  contactMemo: 1000,
  // 카드 첨부 파일: 이름은 글자 수, 크기는 바이트 (storage.rules에도 같은 크기 제한이 있다)
  cardFileName: CARD_FILE_NAME_MAX,
  cardFileBytes: CARD_FILE_MAX_BYTES,
} as const;

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export type ValidationResult<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

// 제어 문자(줄바꿈·탭 제외)와 폭 없는 문자(zero-width)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_CHARS = /[​-‍⁠﻿]/g;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 한 줄 입력 정리: 유니코드 정규화, 보이지 않는 문자 제거, 줄바꿈은 공백으로, 앞뒤 공백 제거 */
export function cleanText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROL_CHARS, "")
    .trim();
}

/** 여러 줄 입력 정리: 줄바꿈은 남긴다 */
export function cleanMultiline(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .trim();
}

export function normalizeEmail(raw: string): string {
  return cleanText(raw).toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= LIMITS.email && EMAIL_PATTERN.test(value);
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((message) => Boolean(message));
}

/** 받침 유무에 따라 조사를 고른다. withParticle("과정 이름", "을", "를") → "과정 이름을" */
export function withParticle(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.charCodeAt(word.length - 1);
  const isHangulSyllable = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangulSyllable) return `${word}${withoutBatchim}`;
  const hasBatchim = (last - 0xac00) % 28 !== 0;
  return `${word}${hasBatchim ? withBatchim : withoutBatchim}`;
}

function tooLongMessage(label: string, max: number, actual: number): string {
  return `${withParticle(label, "은", "는")} ${max}자 이내로 줄여 주세요. (지금 ${actual}자)`;
}

/** 필수 한 줄 텍스트 */
export function checkRequiredText(value: string, label: string, max: number): string | null {
  if (value.length === 0) return `${withParticle(label, "을", "를")} 입력해 주세요.`;
  if (value.length > max) return tooLongMessage(label, max, value.length);
  return null;
}

/** 선택 텍스트 (비워도 됨) */
export function checkOptionalText(value: string, label: string, max: number): string | null {
  if (value.length > max) return tooLongMessage(label, max, value.length);
  return null;
}

function finish<T, K extends string>(value: T, errors: FieldErrors<K>): ValidationResult<T, K> {
  return hasErrors(errors) ? { ok: false, errors } : { ok: true, value };
}

// ---------- 초대 ----------

export function validateInviteEmail(
  raw: string,
): ValidationResult<string, "email"> {
  const email = normalizeEmail(raw);
  if (email.length === 0) {
    return { ok: false, errors: { email: "초대할 사람의 구글 계정 이메일을 입력해 주세요." } };
  }
  if (!isValidEmail(email)) {
    return {
      ok: false,
      errors: { email: "이메일 형식이 아닙니다. 예: name@gmail.com 처럼 입력해 주세요." },
    };
  }
  return { ok: true, value: email };
}

export function validateRole(value: unknown): ValidationResult<Role, "role"> {
  if (!isRole(value)) {
    return { ok: false, errors: { role: "역할을 관리자 또는 강사 중에서 골라 주세요." } };
  }
  return { ok: true, value };
}

// ---------- 과정 ----------

export interface CourseFields {
  title: string;
  client: string;
  description: string;
  instructorEmails: string[];
}

export type CourseField = keyof CourseFields;

export function validateCourseInput(
  input: CourseFields,
): ValidationResult<CourseFields, CourseField> {
  const value: CourseFields = {
    title: cleanText(input.title),
    client: cleanText(input.client),
    description: cleanMultiline(input.description),
    instructorEmails: dedupe(input.instructorEmails.map(normalizeEmail).filter(Boolean)),
  };
  const errors: FieldErrors<CourseField> = {};

  const titleError = checkRequiredText(value.title, "과정 이름", LIMITS.courseTitle);
  if (titleError) errors.title = titleError;

  const clientError = checkOptionalText(value.client, "고객사", LIMITS.courseClient);
  if (clientError) errors.client = clientError;

  const descriptionError = checkOptionalText(
    value.description,
    "과정 설명",
    LIMITS.courseDescription,
  );
  if (descriptionError) errors.description = descriptionError;

  if (value.instructorEmails.length > LIMITS.instructors) {
    errors.instructorEmails = `담당 강사는 ${LIMITS.instructors}명까지 지정할 수 있습니다.`;
  } else if (value.instructorEmails.some((email) => !isValidEmail(email))) {
    errors.instructorEmails = "담당 강사 이메일 중 형식이 맞지 않는 것이 있습니다. 목록에서 다시 골라 주세요.";
  }

  return finish(value, errors);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

// ---------- 카드 ----------

export interface CardFields {
  title: string;
  memo: string;
  assigneeEmail: string | null;
  dueDate: string | null;
}

export type CardField = keyof CardFields;

export function validateCardInput(input: CardFields): ValidationResult<CardFields, CardField> {
  const assignee = input.assigneeEmail ? normalizeEmail(input.assigneeEmail) : "";
  const value: CardFields = {
    title: cleanText(input.title),
    memo: cleanMultiline(input.memo),
    assigneeEmail: assignee.length > 0 ? assignee : null,
    dueDate: input.dueDate && input.dueDate.length > 0 ? input.dueDate : null,
  };
  const errors: FieldErrors<CardField> = {};

  const titleError = checkRequiredText(value.title, "카드 제목", LIMITS.cardTitle);
  if (titleError) errors.title = titleError;

  const memoError = checkOptionalText(value.memo, "메모", LIMITS.cardMemo);
  if (memoError) errors.memo = memoError;

  if (value.assigneeEmail !== null && !isValidEmail(value.assigneeEmail)) {
    errors.assigneeEmail = "담당자를 목록에서 다시 골라 주세요.";
  }
  if (value.dueDate !== null && !isDateString(value.dueDate)) {
    errors.dueDate = "마감일을 달력에서 다시 골라 주세요.";
  }

  return finish(value, errors);
}

export function validateCardTitle(raw: string): ValidationResult<string, "title"> {
  const title = cleanText(raw);
  const error = checkRequiredText(title, "카드 제목", LIMITS.cardTitle);
  return error ? { ok: false, errors: { title: error } } : { ok: true, value: title };
}

export function validateStage(value: unknown): ValidationResult<StageId, "stage"> {
  if (!isStageId(value)) {
    return { ok: false, errors: { stage: "옮길 단계를 다시 골라 주세요." } };
  }
  return { ok: true, value };
}

// ---------- 체크리스트 ----------

export function validateChecklistText(raw: string): ValidationResult<string, "text"> {
  const text = cleanText(raw);
  const error = checkRequiredText(text, "체크리스트 항목", LIMITS.checklistText);
  return error ? { ok: false, errors: { text: error } } : { ok: true, value: text };
}

// ---------- 회차 ----------

export interface SessionFields {
  date: string;
  startTime: string | null;
  location: string;
  audience: string;
  note: string;
}

export type SessionField = keyof SessionFields;

export function validateSessionInput(
  input: SessionFields,
): ValidationResult<SessionFields, SessionField> {
  const value: SessionFields = {
    date: input.date.trim(),
    startTime: input.startTime && input.startTime.trim().length > 0 ? input.startTime.trim() : null,
    location: cleanText(input.location),
    audience: cleanText(input.audience),
    note: cleanMultiline(input.note),
  };
  const errors: FieldErrors<SessionField> = {};

  if (value.date.length === 0) {
    errors.date = "강의 날짜를 골라 주세요.";
  } else if (!isDateString(value.date)) {
    errors.date = "강의 날짜를 달력에서 다시 골라 주세요.";
  }
  if (value.startTime !== null && !isTimeString(value.startTime)) {
    errors.startTime = "시작 시간을 09:30 처럼 입력해 주세요.";
  }

  const locationError = checkOptionalText(value.location, "장소", LIMITS.sessionLocation);
  if (locationError) errors.location = locationError;

  const audienceError = checkOptionalText(value.audience, "대상", LIMITS.sessionAudience);
  if (audienceError) errors.audience = audienceError;

  const noteError = checkOptionalText(value.note, "메모", LIMITS.sessionNote);
  if (noteError) errors.note = noteError;

  return finish(value, errors);
}

// ---------- 재료 ----------

export interface MaterialFields {
  kind: MaterialKind;
  title: string;
  body: string;
  url: string;
  stage: StageId | null;
  memo: string;
  excludeFromAi: boolean;
}

export type MaterialField = keyof MaterialFields;

export function validateMaterialInput(
  input: MaterialFields,
): ValidationResult<MaterialFields, MaterialField> {
  const kind = input.kind;
  const value: MaterialFields = {
    kind,
    title: cleanText(input.title),
    body: cleanMultiline(input.body),
    // 링크가 아닌 재료에는 주소를 두지 않는다
    url: kind === "link" ? cleanText(input.url) : "",
    stage: input.stage,
    memo: cleanMultiline(input.memo),
    excludeFromAi: input.excludeFromAi === true,
  };
  const errors: FieldErrors<MaterialField> = {};

  if (!isMaterialKind(kind)) errors.kind = "재료 종류를 다시 골라 주세요.";

  const titleError = checkRequiredText(value.title, "재료 제목", LIMITS.materialTitle);
  if (titleError) errors.title = titleError;

  const bodyError =
    isMaterialKind(kind) && hasTextBody(kind)
      ? checkRequiredText(value.body, "내용", LIMITS.materialBody)
      : checkOptionalText(value.body, "설명", LIMITS.materialBody);
  if (bodyError) errors.body = bodyError;

  if (kind === "link") {
    if (value.url.length === 0) {
      errors.url = "링크 주소를 입력해 주세요.";
    } else if (value.url.length > LIMITS.materialUrl) {
      errors.url = `링크 주소는 ${LIMITS.materialUrl}자 이내여야 합니다.`;
    } else if (!isHttpUrl(value.url)) {
      errors.url = "https:// 로 시작하는 웹 주소를 붙여 넣어 주세요.";
    }
  }

  if (value.stage !== null && !isStageId(value.stage)) errors.stage = "관련 단계를 목록에서 다시 골라 주세요.";

  const memoError = checkOptionalText(value.memo, "메모", LIMITS.materialMemo);
  if (memoError) errors.memo = memoError;

  return finish(value, errors);
}

// ---------- 초안 ----------

export interface DraftFields {
  kind: DraftKind;
  content: string;
  request: string;
  materialIds: string[];
}

export type DraftField = keyof DraftFields;

export function validateDraftInput(input: DraftFields): ValidationResult<DraftFields, DraftField> {
  const value: DraftFields = {
    kind: input.kind,
    content: cleanMultiline(input.content),
    request: cleanMultiline(input.request),
    materialIds: dedupe(input.materialIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 128)),
  };
  const errors: FieldErrors<DraftField> = {};

  if (!isDraftKind(value.kind)) errors.kind = "초안 종류를 다시 골라 주세요.";

  const contentError = checkRequiredText(value.content, "초안 내용", LIMITS.draftContent);
  if (contentError) {
    errors.content =
      value.content.length === 0 ? "AI가 준 답을 붙여 넣어 주세요." : contentError;
  }

  const requestError = checkOptionalText(value.request, "추가 요청", LIMITS.draftRequest);
  if (requestError) errors.request = requestError;

  if (value.materialIds.length > LIMITS.draftMaterials) {
    errors.materialIds = `재료는 ${LIMITS.draftMaterials}개까지 고를 수 있습니다.`;
  }

  return finish(value, errors);
}

/** 초안 고치기: 내용만 */
export function validateDraftContent(raw: string): ValidationResult<string, "content"> {
  const content = cleanMultiline(raw);
  const error = checkRequiredText(content, "초안 내용", LIMITS.draftContent);
  return error ? { ok: false, errors: { content: error } } : { ok: true, value: content };
}

// ---------- 결과물 ----------

/** 최종본 링크. 비우면(빈 문자열) 링크를 지운다 */
export function validateOutputLink(raw: string): ValidationResult<string, "finalUrl"> {
  const url = cleanText(raw);
  if (url.length === 0) return { ok: true, value: "" };
  if (url.length > LIMITS.outputUrl) {
    return { ok: false, errors: { finalUrl: `링크 주소는 ${LIMITS.outputUrl}자 이내여야 합니다.` } };
  }
  if (!isHttpUrl(url)) {
    return { ok: false, errors: { finalUrl: "https:// 로 시작하는 웹 주소를 붙여 넣어 주세요." } };
  }
  return { ok: true, value: url };
}

// ---------- 일정 (리허설·회의) ----------

export interface EventFields {
  kind: EventKind;
  title: string;
  date: string;
  startTime: string | null;
  note: string;
}

export type EventField = keyof EventFields;

export function validateEventInput(input: EventFields): ValidationResult<EventFields, EventField> {
  const value: EventFields = {
    kind: input.kind,
    title: cleanText(input.title),
    date: input.date.trim(),
    startTime: input.startTime && input.startTime.trim().length > 0 ? input.startTime.trim() : null,
    note: cleanMultiline(input.note),
  };
  const errors: FieldErrors<EventField> = {};

  if (!isEventKind(value.kind)) errors.kind = "일정 종류를 다시 골라 주세요.";

  const titleError = checkRequiredText(value.title, "일정 이름", LIMITS.eventTitle);
  if (titleError) errors.title = titleError;

  if (value.date.length === 0) {
    errors.date = "날짜를 골라 주세요.";
  } else if (!isDateString(value.date)) {
    errors.date = "날짜를 달력에서 다시 골라 주세요.";
  }
  if (value.startTime !== null && !isTimeString(value.startTime)) {
    errors.startTime = "시작 시간을 09:30 처럼 입력해 주세요.";
  }

  const noteError = checkOptionalText(value.note, "메모", LIMITS.eventNote);
  if (noteError) errors.note = noteError;

  return finish(value, errors);
}

// ---------- 강사료 ----------

export interface FeeFields {
  courseId: string;
  /** 강사료를 받는 강사 (소문자 이메일) */
  instructorEmail: string;
  /** "1회차", "선금" 같은 항목 이름 (비워도 됨) */
  label: string;
  /** 원 단위 정수 */
  amount: number;
  dueDate: string;
  /** 입금일. null이면 아직 입금 전 */
  paidDate: string | null;
  memo: string;
}

export type FeeField = keyof FeeFields;

/** 화면 입력: 금액은 "1,200,000" 같은 글자로 넘겨도 된다 */
export interface FeeFormInput extends Omit<FeeFields, "amount"> {
  amount: number | string;
}

/** 고칠 수 있는 칸 (과정·강사는 바꿀 수 없다) */
export type FeePatchInput = Partial<Pick<FeeFormInput, "label" | "amount" | "dueDate" | "paidDate" | "memo">>;

function checkFeeAmount(raw: number | string): { amount: number; error: string | null } {
  const amount = typeof raw === "number" ? raw : parseWon(raw);
  if (typeof raw === "string" && raw.trim().length === 0) {
    return { amount: 0, error: "금액을 입력해 주세요." };
  }
  if (amount === null || !Number.isSafeInteger(amount)) {
    return { amount: 0, error: "금액은 1,200,000 처럼 숫자로만 입력해 주세요." };
  }
  if (amount < 1) return { amount, error: "금액은 1원 이상이어야 합니다." };
  if (amount > LIMITS.feeAmount) {
    return { amount, error: `금액이 너무 큽니다. ${formatWon(LIMITS.feeAmount)} 이하로 입력해 주세요.` };
  }
  return { amount, error: null };
}

function checkNullableDate(value: string | null, label: string): string | null {
  if (value === null) return null;
  return isDateString(value) ? null : `${withParticle(label, "을", "를")} 달력에서 다시 골라 주세요.`;
}

function cleanNullableDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateFeeInput(input: FeeFormInput): ValidationResult<FeeFields, FeeField> {
  const amountCheck = checkFeeAmount(input.amount);
  const value: FeeFields = {
    courseId: input.courseId.trim(),
    instructorEmail: normalizeEmail(input.instructorEmail),
    label: cleanText(input.label),
    amount: amountCheck.amount,
    dueDate: input.dueDate.trim(),
    paidDate: cleanNullableDate(input.paidDate),
    memo: cleanMultiline(input.memo),
  };
  const errors: FieldErrors<FeeField> = {};

  if (value.courseId.length === 0) errors.courseId = "과정을 골라 주세요.";
  if (!isValidEmail(value.instructorEmail)) errors.instructorEmail = "강사료를 받을 강사를 골라 주세요.";

  const labelError = checkOptionalText(value.label, "항목 이름", LIMITS.feeLabel);
  if (labelError) errors.label = labelError;

  if (amountCheck.error) errors.amount = amountCheck.error;

  if (value.dueDate.length === 0) {
    errors.dueDate = "입금 예정일을 골라 주세요.";
  } else if (!isDateString(value.dueDate)) {
    errors.dueDate = "입금 예정일을 달력에서 다시 골라 주세요.";
  }

  const paidError = checkNullableDate(value.paidDate, "입금일");
  if (paidError) errors.paidDate = paidError;

  const memoError = checkOptionalText(value.memo, "메모", LIMITS.feeMemo);
  if (memoError) errors.memo = memoError;

  return finish(value, errors);
}

const FEE_DEFAULTS: FeeFormInput = {
  courseId: "course",
  instructorEmail: "a@example.com",
  label: "",
  amount: 1,
  dueDate: "2000-01-01",
  paidDate: null,
  memo: "",
};

/** 강사료 고치기: 넘어온 칸만 검사하고 정리한 값을 돌려준다 */
export function validateFeePatch(patch: FeePatchInput): ValidationResult<Partial<FeeFields>, FeeField> {
  const keys = (Object.keys(patch) as Array<keyof FeePatchInput>).filter((key) => patch[key] !== undefined);
  const merged: FeeFormInput = { ...FEE_DEFAULTS };
  for (const key of keys) {
    Object.assign(merged, { [key]: patch[key] });
  }
  const result = validateFeeInput(merged);
  if (!result.ok) return result;
  const value: Partial<FeeFields> = {};
  for (const key of keys) {
    Object.assign(value, { [key]: result.value[key] });
  }
  return { ok: true, value };
}

// ---------- 고객사 주소록 ----------

export interface ClientFields {
  name: string;
  memo: string;
}

export type ClientField = keyof ClientFields;

export function validateClientInput(input: ClientFields): ValidationResult<ClientFields, ClientField> {
  const value: ClientFields = { name: cleanText(input.name), memo: cleanMultiline(input.memo) };
  const errors: FieldErrors<ClientField> = {};

  const nameError = checkRequiredText(value.name, "고객사 이름", LIMITS.clientName);
  if (nameError) errors.name = nameError;

  const memoError = checkOptionalText(value.memo, "메모", LIMITS.clientMemo);
  if (memoError) errors.memo = memoError;

  return finish(value, errors);
}

export interface ContactFields {
  clientId: string;
  name: string;
  /** 부서·직책 */
  role: string;
  phone: string;
  /** 소문자 이메일. 비워도 됨 */
  email: string;
  memo: string;
}

export type ContactField = keyof ContactFields;

/** 고칠 수 있는 칸 (어느 고객사의 담당자인지는 바꿀 수 없다) */
export type ContactPatchInput = Partial<Omit<ContactFields, "clientId">>;

export function validateContactInput(input: ContactFields): ValidationResult<ContactFields, ContactField> {
  const value: ContactFields = {
    clientId: input.clientId.trim(),
    name: cleanText(input.name),
    role: cleanText(input.role),
    phone: cleanText(input.phone).normalize("NFKC"),
    email: normalizeEmail(input.email),
    memo: cleanMultiline(input.memo),
  };
  const errors: FieldErrors<ContactField> = {};

  if (value.clientId.length === 0) errors.clientId = "고객사를 골라 주세요.";

  const nameError = checkRequiredText(value.name, "담당자 이름", LIMITS.contactName);
  if (nameError) errors.name = nameError;

  const roleError = checkOptionalText(value.role, "부서·직책", LIMITS.contactRole);
  if (roleError) errors.role = roleError;

  const phoneError = checkOptionalText(value.phone, "전화번호", LIMITS.contactPhone);
  if (phoneError) {
    errors.phone = phoneError;
  } else if (!isPhoneValue(value.phone)) {
    errors.phone = "전화번호는 숫자와 - 만 써 주세요. 내선 번호 같은 설명은 메모에 적어 주세요.";
  }

  if (value.email.length > 0 && !isValidEmail(value.email)) {
    errors.email = "이메일 주소를 name@company.com 형식으로 다시 확인해 주세요.";
  }

  const memoError = checkOptionalText(value.memo, "메모", LIMITS.contactMemo);
  if (memoError) errors.memo = memoError;

  return finish(value, errors);
}

const CLIENT_DEFAULTS: ClientFields = { name: "고객사", memo: "" };

export function validateClientPatch(
  patch: Partial<ClientFields>,
): ValidationResult<Partial<ClientFields>, ClientField> {
  return validatePatch(patch, CLIENT_DEFAULTS, validateClientInput);
}

const CONTACT_DEFAULTS: ContactFields = { clientId: "client", name: "담당자", role: "", phone: "", email: "", memo: "" };

export function validateContactPatch(
  patch: ContactPatchInput,
): ValidationResult<Partial<ContactFields>, ContactField> {
  return validatePatch(patch, CONTACT_DEFAULTS, validateContactInput);
}

// ---------- 이동 경로 ----------

// 경로 검사용 가짜 주소. 실제로 접속하지 않고, "같은 사이트 안인지" 해석할 때만 쓴다.
const PATH_CHECK_ORIGIN = "https://same-site.invalid";
// 제어 문자(탭·줄바꿈 포함)와 역슬래시. 브라우저 주소 해석기가 이것들을 지우거나 "/"로 바꿔서
// "/\t/evil.example" 같은 값이 외부 주소 "//evil.example"로 바뀌는 것을 막는다.
const UNSAFE_PATH_CHARS = /[\u0000-\u001F\u007F\\]/;

/** 로그인 뒤 돌아갈 경로. 같은 사이트 안의 경로만 허용한다 (외부 주소로 튕기는 공격 방지). */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (UNSAFE_PATH_CHARS.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  // 브라우저와 같은 방식으로 해석해 본 뒤, 다른 사이트로 바뀌면 거부한다
  let parsed: URL;
  try {
    parsed = new URL(raw, PATH_CHECK_ORIGIN);
  } catch {
    return fallback;
  }
  if (parsed.origin !== PATH_CHECK_ORIGIN) return fallback;
  if (parsed.pathname === "/login" || parsed.pathname.startsWith("/login/")) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

// ---------- 일부 칸만 고칠 때 ----------

/**
 * 넘어온 칸만 검증하고 정리한 값을 돌려준다.
 * defaults는 항상 검증을 통과하는 값이라, 오류가 나면 그 오류는 넘어온 칸의 것이다.
 */
function validatePatch<T extends object, K extends string & keyof T>(
  patch: Partial<T>,
  defaults: T,
  full: (input: T) => ValidationResult<T, K>,
): ValidationResult<Partial<T>, K> {
  const keys = (Object.keys(patch) as K[]).filter((key) => patch[key] !== undefined);
  const merged: T = { ...defaults };
  for (const key of keys) {
    merged[key] = patch[key] as T[K];
  }
  const result = full(merged);
  if (!result.ok) return result;
  const value: Partial<T> = {};
  for (const key of keys) {
    value[key] = result.value[key];
  }
  return { ok: true, value };
}

const COURSE_DEFAULTS: CourseFields = {
  title: "과정",
  client: "",
  description: "",
  instructorEmails: [],
};

const CARD_DEFAULTS: CardFields = {
  title: "카드",
  memo: "",
  assigneeEmail: null,
  dueDate: null,
};

const SESSION_DEFAULTS: SessionFields = {
  date: "2000-01-01",
  startTime: null,
  location: "",
  audience: "",
  note: "",
};

export function validateCoursePatch(
  patch: Partial<CourseFields>,
): ValidationResult<Partial<CourseFields>, CourseField> {
  return validatePatch(patch, COURSE_DEFAULTS, validateCourseInput);
}

export function validateCardPatch(
  patch: Partial<CardFields>,
): ValidationResult<Partial<CardFields>, CardField> {
  return validatePatch(patch, CARD_DEFAULTS, validateCardInput);
}

const EVENT_DEFAULTS: EventFields = {
  kind: "meeting",
  title: "일정",
  date: "2000-01-01",
  startTime: null,
  note: "",
};

export function validateEventPatch(
  patch: Partial<EventFields>,
): ValidationResult<Partial<EventFields>, EventField> {
  return validatePatch(patch, EVENT_DEFAULTS, validateEventInput);
}

/** 재료 고치기. 종류는 바꿀 수 없으므로 지금 종류를 함께 받아 그 종류 기준으로 검사한다 */
export function validateMaterialPatch(
  kind: MaterialKind,
  patch: Partial<Omit<MaterialFields, "kind">>,
): ValidationResult<Partial<MaterialFields>, MaterialField> {
  const defaults: MaterialFields = {
    kind,
    title: "재료",
    body: hasTextBody(kind) ? "내용" : "",
    url: kind === "link" ? "https://example.com" : "",
    stage: null,
    memo: "",
    excludeFromAi: false,
  };
  return validatePatch(patch, defaults, validateMaterialInput);
}

export function validateSessionPatch(
  patch: Partial<SessionFields>,
): ValidationResult<Partial<SessionFields>, SessionField> {
  return validatePatch(patch, SESSION_DEFAULTS, validateSessionInput);
}
