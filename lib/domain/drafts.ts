// AI 초안 (PRD F6): 초안 종류, 판 번호, 기록 정리, "AI에 붙여 넣을 요청문" 만들기. 순수 함수.
// 앱이 AI를 직접 부르지 않는다. 요청문을 만들어 주면 강사가 Claude·ChatGPT 웹에 붙여 넣고,
// 받은 답을 다시 앱에 붙여 넣는다 (API 키·사용료 없음). "AI에 보내지 않음" 재료는 요청문에 넣지 않는다.

import { formatDateKo, type DateString } from "./dates";
import { MATERIAL_KIND_LABELS, type MaterialKind } from "./materials";
import { stageLabel, type StageId } from "./stages";

export const DRAFT_KINDS = ["curriculum", "slides", "lab"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_KIND_LABELS: Record<DraftKind, string> = {
  curriculum: "커리큘럼",
  slides: "슬라이드별 내용",
  lab: "실습 안내서",
};

export function isDraftKind(value: unknown): value is DraftKind {
  return typeof value === "string" && (DRAFT_KINDS as readonly string[]).includes(value);
}

/** 종류별로 남기는 초안 판 수 (PRD: 최근 10개) */
export const DRAFT_HISTORY_LIMIT = 10;

interface Versioned {
  id: string;
  kind: DraftKind;
  version: number;
}

/** 이 종류의 다음 판 번호 (1부터) */
export function nextVersion(items: readonly Versioned[], kind: DraftKind): number {
  return items.filter((item) => item.kind === kind).reduce((max, item) => Math.max(max, item.version), 0) + 1;
}

/**
 * 새 판을 하나 더 저장할 때 지울 옛 판의 id (오래된 것부터).
 * 저장 뒤에도 limit개가 넘지 않게, 지금 있는 것 중 (limit - 1)개만 남긴다.
 */
export function draftsToPrune(items: readonly Versioned[], kind: DraftKind, limit = DRAFT_HISTORY_LIMIT): string[] {
  const sameKind = items.filter((item) => item.kind === kind).sort((a, b) => b.version - a.version);
  return sameKind.slice(Math.max(0, limit - 1)).map((item) => item.id);
}

// ---------- 요청문 ----------

/** 요청문 전체 길이 상한. 웹 AI 입력창에 한 번에 붙여 넣을 수 있는 정도로 잡았다 */
export const PROMPT_CHAR_LIMIT = 150_000;

export interface PromptCourse {
  title: string;
  client: string;
  description: string;
}

export interface PromptSession {
  date: DateString;
  startTime: string | null;
  location: string;
  audience: string;
}

export interface PromptMaterial {
  id: string;
  kind: MaterialKind;
  title: string;
  body: string;
  url: string;
  memo: string;
  stage: StageId | null;
  excludeFromAi: boolean;
}

export interface PromptInput {
  kind: DraftKind;
  course: PromptCourse;
  sessions: readonly PromptSession[];
  /** 강사가 고른 재료 (순서대로 넣는다) */
  materials: readonly PromptMaterial[];
  /** "실습 비중을 늘려 줘" 같은 추가 요청 */
  request: string;
}

export interface BuiltPrompt {
  text: string;
  /** 요청문에 들어간 재료 */
  includedIds: string[];
  /** "AI에 보내지 않음"이라 뺀 재료 */
  excludedIds: string[];
  /** 길이 상한 때문에 일부만 넣었거나 뺀 재료 */
  cutIds: string[];
}

const FORMAT_GUIDES: Record<DraftKind, string> = {
  curriculum: [
    "아래 마크다운 형식으로만 답해 주세요.",
    "# 과정 제목",
    "## 학습 목표",
    "- 학습 목표 (3~5개)",
    "## 모듈 구성",
    "### 모듈 1. 모듈 이름 (60분)",
    "- 학습 목표: …",
    "- 주요 내용: …",
    "- 진행 방식: 강의 / 실습 / 토의 중에서",
    "(모듈마다 반복)",
    "## 시간 배분 요약",
    "- 모듈 1: 60분",
  ].join("\n"),
  slides: [
    "슬라이드마다 아래 형식을 반복해 주세요. 이 형식 그대로 PPT 파일로 바뀌므로 형식을 꼭 지켜 주세요.",
    "# 발표 제목 (맨 위에 한 번)",
    "## 슬라이드 제목",
    "- 핵심 메시지 (한 줄씩 3~5개)",
    "노트: 발표자가 말할 내용 (2~4문장)",
  ].join("\n"),
  lab: [
    "아래 마크다운 형식으로만 답해 주세요.",
    "# 실습 제목",
    "## 실습 목표",
    "## 준비물",
    "## 진행 단계",
    "### 1단계. 단계 이름",
    "- 학습자가 할 일",
    "(단계마다 반복)",
    "## 예상 결과물",
    "## 막혔을 때 도움말",
  ].join("\n"),
};

function sessionLine(session: PromptSession): string {
  const when = `${formatDateKo(session.date, { withYear: true })}${session.startTime ? ` ${session.startTime}` : ""}`;
  const extra = [session.location, session.audience].filter((part) => part.trim().length > 0).join(" · ");
  return `- ${when}${extra ? ` · ${extra}` : ""}`;
}

function materialBlock(material: PromptMaterial, index: number, body: string): string {
  const tags = [MATERIAL_KIND_LABELS[material.kind], material.stage ? `${stageLabel(material.stage)} 단계` : null]
    .filter(Boolean)
    .join(", ");
  const lines = [`### 재료 ${index}. ${material.title} (${tags})`];
  if (material.memo.trim()) lines.push(`메모: ${material.memo.trim()}`);
  if (material.url.trim()) lines.push(`링크: ${material.url.trim()} (링크 안 내용은 볼 수 없으면 제목·메모만 참고)`);
  if (body.trim()) lines.push('"""', body.trim(), '"""');
  return lines.join("\n");
}

/** 강사가 웹 AI에 붙여 넣을 요청문. 재료는 길이 상한 안에서 고른 순서대로 넣는다 */
export function buildDraftPrompt(input: PromptInput): BuiltPrompt {
  const label = DRAFT_KIND_LABELS[input.kind];
  const head: string[] = [
    `당신은 기업 교육 과정을 설계하는 교수설계 전문가입니다. 아래 과정 정보와 재료를 바탕으로 "${label}" 초안을 한국어로 작성해 주세요.`,
    "",
    "## 과정 정보",
    `- 과정 이름: ${input.course.title}`,
  ];
  if (input.course.client.trim()) head.push(`- 고객사: ${input.course.client.trim()}`);
  if (input.course.description.trim()) head.push(`- 과정 설명: ${input.course.description.trim()}`);
  if (input.sessions.length > 0) {
    head.push("- 회차:");
    for (const session of input.sessions) head.push(`  ${sessionLine(session)}`);
  }
  if (input.request.trim()) head.push("", "## 추가 요청", input.request.trim());
  head.push("", "## 작성 형식", FORMAT_GUIDES[input.kind]);

  const tail = [
    "",
    "## 지켜 주세요",
    "- 재료에 없는 사실(숫자, 사례, 고객사 정보)은 지어내지 말고, 필요하면 [확인 필요]라고 표시해 주세요.",
    "- 답에는 초안만 쓰고, 앞뒤 인사말이나 설명은 쓰지 마세요.",
  ].join("\n");

  const sendable = input.materials.filter((material) => !material.excludeFromAi);
  const excludedIds = input.materials.filter((material) => material.excludeFromAi).map((material) => material.id);

  let text = head.join("\n");
  const includedIds: string[] = [];
  const cutIds: string[] = [];
  if (sendable.length > 0) text += `\n\n## 재료 (${sendable.length}개)`;

  sendable.forEach((material, index) => {
    const room = PROMPT_CHAR_LIMIT - text.length - tail.length - 200;
    const full = materialBlock(material, index + 1, material.body);
    if (full.length + 2 <= room) {
      text += `\n\n${full}`;
      includedIds.push(material.id);
      return;
    }
    cutIds.push(material.id);
    // 남은 자리만큼 본문 앞부분만 넣는다. 자리가 거의 없으면 통째로 뺀다
    const shortBody = material.body.slice(0, Math.max(0, room - 400));
    if (shortBody.length >= 200) {
      text += `\n\n${materialBlock(material, index + 1, `${shortBody}\n…(길어서 뒷부분은 뺐습니다)`)}`;
      includedIds.push(material.id);
    }
  });

  return { text: `${text}\n${tail}`, includedIds, excludedIds, cutIds };
}
