// 카드 첨부 파일 규칙: 올릴 수 있는 형식·크기·개수, 파일 이름 다듬기, 크기 표시, 카드별로 묶기.
// 형식·크기 제한은 storage.rules와 firestore.rules(limitCardFile*)에도 같은 값이 있다.
// tests/unit/card-files.test.ts가 세 곳의 값이 어긋나지 않았는지 검사한다.

/** 파일 하나 최대 크기: 100MB (PRD F4의 가정과 같다) */
export const CARD_FILE_MAX_BYTES = 100 * 1024 * 1024;

/** 카드 하나에 붙일 수 있는 파일 수. 보안 규칙으로는 셀 수 없어서 화면에서만 막는다 */
export const CARD_FILES_PER_CARD = 20;

/** 파일 이름 최대 글자 수 (확장자 포함) */
export const CARD_FILE_NAME_MAX = 200;

/** 올리는 중 이 시간 동안 진행이 전혀 없으면 멈춘 것으로 보고 실패로 알린다 */
export const CARD_FILE_STALL_MS = 30_000;

/**
 * 확장자 → 저장할 때 붙이는 형식(Content-Type). 여기 없는 확장자는 올릴 수 없다 (허용 목록).
 * 브라우저가 알려 주는 형식은 기기마다 달라서(한글 파일은 비어 오기도 한다) 쓰지 않고, 확장자로 정한다.
 * html·svg처럼 열면 스크립트가 돌 수 있는 형식은 넣지 않는다.
 */
export const CARD_FILE_TYPES: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  zip: "application/zip",
};

/** 허용 형식을 사람이 읽는 말로 */
export const CARD_FILE_KINDS_TEXT = "PDF·PPT·워드·한글·엑셀·이미지·음성·ZIP";

/** 파일 고르기 버튼 옆 안내 */
export const CARD_FILE_HINT = `${CARD_FILE_KINDS_TEXT} 파일, 하나에 100MB까지 · 카드 하나에 ${CARD_FILES_PER_CARD}개까지`;

// 제어 문자와 폭 없는 문자(zero-width)
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F​-‍⁠﻿]/g;
// 저장 위치(경로)에서 문제가 되는 글자: 폴더 구분자(/ \), 윈도 금지 문자, Storage 권장 금지 문자(# [ ] * ?)
const UNSAFE_NAME_CHARS = /[\\/:*?"<>|#[\]]/g;

/** "보고서.final.PDF" → "pdf". 확장자가 없으면 빈 문자열 */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** 확장자에 맞는 형식. 올릴 수 없는 형식이면 null */
export function contentTypeFor(name: string): string | null {
  return CARD_FILE_TYPES[fileExtension(name)] ?? null;
}

/** 글자를 앞에서부터 max(UTF-16 길이)까지 자른다. 이모지 같은 두 칸짜리 글자를 반으로 쪼개지 않는다 */
function cutToLength(text: string, max: number): string {
  let result = "";
  for (const char of Array.from(text)) {
    if (result.length + char.length > max) break;
    result += char;
  }
  return result;
}

/**
 * 저장할 파일 이름으로 다듬는다.
 * - 맥에서 온 파일은 한글 자모가 분리되어 있어(NFD) 합친다(NFC). 안 합치면 검색·정렬이 어긋난다.
 * - 보이지 않는 문자는 지우고, 경로에 문제가 되는 글자는 _로 바꾼다.
 * - 너무 길면 확장자는 남기고 앞부분을 자른다.
 */
export function cleanFileName(raw: string): string {
  const cleaned = raw
    .normalize("NFC")
    .replace(INVISIBLE_CHARS, "")
    .replace(UNSAFE_NAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .trim()
    // "."·".."처럼 점으로 시작하는 이름은 경로에서 특별한 뜻이 있어 앞의 점을 뗀다
    .replace(/^\.+/, "");

  // 확장자는 대소문자를 바꾸지 않고 그대로 둔다 ("회의록.DOCX"는 그대로)
  const suffix = fileExtension(cleaned) ? cleaned.slice(cleaned.lastIndexOf(".")) : "";
  const base = cleaned.slice(0, cleaned.length - suffix.length).trim();
  const safeBase = base.length > 0 ? base : "파일";
  return `${cutToLength(safeBase, CARD_FILE_NAME_MAX - suffix.length).trim()}${suffix}`;
}

/** 512 → "512B", 12_300 → "12KB", 2_400_000 → "2.3MB" */
export function formatFileSize(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes < KB) return `${Math.max(0, Math.round(bytes))}B`;
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))}KB`;
  if (bytes < GB) {
    const value = bytes / MB;
    return value < 10 ? `${value.toFixed(1)}MB` : `${Math.round(value)}MB`;
  }
  return `${(bytes / GB).toFixed(1)}GB`;
}

export interface CheckedCardFile {
  /** 다듬은 이름 */
  name: string;
  contentType: string;
}

export type CardFileCheck = { ok: true; value: CheckedCardFile } | { ok: false; message: string };

/** 고른 파일을 올릴 수 있는지. 안 되면 사용자에게 보여 줄 이유를 돌려준다 */
export function checkCardFile(file: { name: string; size: number }): CardFileCheck {
  const name = cleanFileName(file.name);
  const contentType = contentTypeFor(name);
  if (contentType === null) {
    return {
      ok: false,
      message: `"${name}" 파일은 올릴 수 없는 형식입니다. ${CARD_FILE_KINDS_TEXT} 파일만 올릴 수 있습니다.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, message: `"${name}" 파일이 비어 있습니다. 내용이 있는 파일인지 확인한 뒤 다시 골라 주세요.` };
  }
  if (file.size > CARD_FILE_MAX_BYTES) {
    return {
      ok: false,
      message: `"${name}" 파일이 너무 큽니다(${formatFileSize(file.size)}). 100MB 이하로 줄이거나, 구글 드라이브에 올린 뒤 재료함에 링크로 남겨 주세요.`,
    };
  }
  return { ok: true, value: { name, contentType } };
}

/** 카드에 더 붙일 수 있는 파일 수 */
export function fileSlotsLeft(existingCount: number): number {
  return Math.max(0, CARD_FILES_PER_CARD - existingCount);
}

/** 개수를 넘어 빠진 파일 안내 */
export function tooManyFilesMessage(skipped: number): string {
  return `카드 하나에는 파일을 ${CARD_FILES_PER_CARD}개까지 붙일 수 있어 ${skipped}개는 넣지 않았습니다. 필요 없는 파일을 지운 뒤 다시 골라 주세요.`;
}

/**
 * Storage 안 저장 위치: materials/{올린 사람 uid}/{과정}/{카드}/{파일 id}/{이름}.
 * storage.rules의 match 경로, firestore.rules의 storagePath 검사, 서버 함수(functions/src/lectureRules.ts의
 * parseMaterialPath)와 모양이 같아야 한다. 서버 함수는 경로의 uid로 올린 사람을 알아낸다.
 * (2026-10-25 이전에 올린 파일은 courses/{과정}/cardFiles/{파일 id}/{이름}에 그대로 있다)
 */
export function cardFilePath(uid: string, courseId: string, cardId: string, fileId: string, name: string): string {
  return `materials/${uid}/${courseId}/${cardId}/${fileId}/${name}`;
}

/**
 * 내려받을 때 원래 파일 이름이 유지되도록 붙이는 헤더 값.
 * PDF·이미지는 새 탭에서 바로 보이고(inline), PPT·한글처럼 브라우저가 못 여는 형식은 이 이름으로 내려받아진다.
 */
export function contentDispositionFor(name: string): string {
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename*=UTF-8''${encoded}`;
}

/** 0~100 사이 정수 */
export function uploadPercent(transferred: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((transferred / total) * 100)));
}

interface FileLike {
  cardId: string;
  createdAt: number | null;
}

/** 카드 id → 그 카드의 파일 (올린 순서, 아직 서버 시각이 없는 방금 올린 파일은 맨 뒤) */
export function groupFilesByCard<T extends FileLike>(files: readonly T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const file of files) {
    (groups[file.cardId] ??= []).push(file);
  }
  for (const cardId of Object.keys(groups)) {
    groups[cardId].sort(
      (a, b) => (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return groups;
}

/** 카드 id → 파일 수 */
export function countFilesByCard(files: readonly FileLike[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    counts[file.cardId] = (counts[file.cardId] ?? 0) + 1;
  }
  return counts;
}
