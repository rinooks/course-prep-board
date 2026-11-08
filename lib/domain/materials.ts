// 재료함 (PRD F4): 재료 종류, 웹 주소 검사, 걸러 보기. 순수 함수.
// 재료함은 파일 저장소(Storage)를 쓰지 않으므로 재료는 글(붙여 넣기·받아쓰기)과 링크만 있다.
// 음성·문서 파일은 구글 드라이브 같은 곳에 두고 링크로 남긴다. (Storage는 카드 첨부 파일에만 쓴다)

import type { StageId } from "./stages";

export const MATERIAL_KINDS = ["text", "dictation", "link"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  text: "붙여 넣은 글",
  dictation: "받아쓰기",
  link: "링크",
};

export function isMaterialKind(value: unknown): value is MaterialKind {
  return typeof value === "string" && (MATERIAL_KINDS as readonly string[]).includes(value);
}

/** 글이 본문인 종류 (링크는 본문이 선택) */
export function hasTextBody(kind: MaterialKind): boolean {
  return kind === "text" || kind === "dictation";
}

/** http:// 또는 https://로 시작하는 올바른 웹 주소인지. 공백이 있으면 안 된다 */
export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/** 걸러 보기·찾기에 필요한 재료 정보 */
export interface MaterialLike {
  id: string;
  kind: MaterialKind;
  title: string;
  stage: StageId | null;
  createdBy: string;
  createdAt: number | null;
  deletedAt: number | null;
}

export interface MaterialFilter {
  /** null이면 모든 종류 */
  kind: MaterialKind | null;
  /** null이면 모든 단계. "none"이면 단계를 정하지 않은 재료만 */
  stage: StageId | "none" | null;
  /** null이면 모든 사람 */
  author: string | null;
  /** 제목 찾기 (대소문자·앞뒤 공백 무시) */
  query: string;
}

export const EMPTY_MATERIAL_FILTER: MaterialFilter = { kind: null, stage: null, author: null, query: "" };

/** 휴지통에 없는 재료 중 조건에 맞는 것을 최근에 올린 순으로 */
export function filterMaterials<T extends MaterialLike>(materials: readonly T[], filter: MaterialFilter): T[] {
  const query = filter.query.trim().toLowerCase();
  return materials
    .filter((material) => material.deletedAt === null)
    .filter((material) => filter.kind === null || material.kind === filter.kind)
    .filter((material) => {
      if (filter.stage === null) return true;
      if (filter.stage === "none") return material.stage === null;
      return material.stage === filter.stage;
    })
    .filter((material) => filter.author === null || material.createdBy === filter.author)
    .filter((material) => query.length === 0 || material.title.toLowerCase().includes(query))
    .sort((a, b) => {
      const timeA = a.createdAt ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.createdAt ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeB - timeA;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
