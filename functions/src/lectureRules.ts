// 교안이 올라왔을 때 카드를 옮길지, 활동 기록에 무엇을 남길지 정하는 규칙 (PRD F9, L7).
// Firebase를 쓰지 않는 순수 함수만 둔다. 루트의 tests/unit/lecture-upload.test.ts가 테스트한다.
//
// functions 폴더는 따로 배포되어 웹 앱 코드(lib/)를 불러올 수 없다. 그래서 아래 값은 웹 앱과 겹쳐 적었다:
// - 단계 id·이름: lib/domain/stages.ts
// - 저장 위치 모양: lib/domain/cardFiles.ts의 cardFilePath
// - 순서 간격: lib/domain/ordering.ts의 ORDER_STEP
// 테스트가 두 곳의 값이 같은지 대조한다.

/** 단계 id → 화면 이름 (lib/domain/stages.ts와 같아야 한다) */
export const STAGE_LABELS: Readonly<Record<string, string>> = {
  request: "고객사 요청 확인",
  curriculum: "커리큘럼",
  lecture: "교안",
  practice: "실습 자료",
  rehearsal: "리허설",
  dayof: "당일 준비물",
  survey: "사후 설문",
};

/** 이 단계에 있는 카드만 옮긴다. 요청서의 '섭외'·'교안 작성' 칸에 해당한다 */
export const MOVE_FROM_STAGES: readonly string[] = ["request", "lecture"];

/** 옮겨 갈 단계 */
export const MOVE_TO_STAGE = "rehearsal";

/** 교안으로 보는 파일 형식 (확장자). 이미지·엑셀 같은 파일은 카드를 옮기지 않는다 */
export const LECTURE_EXTENSIONS: readonly string[] = ["ppt", "pptx", "pdf"];

/** 카드 순서 간격 (lib/domain/ordering.ts와 같아야 한다) */
export const ORDER_STEP = 1024;

/** 알림이 이보다 오래 실패하며 다시 오면 포기한다 (코드 실수로 끝없이 다시 시도하지 않게) */
export const MAX_EVENT_AGE_MS = 60 * 60 * 1000;

/** 활동 기록 컬렉션 */
export const ACTIVITY_COLLECTION = "activity";

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** 저장 위치 materials/{올린 사람 uid}/{과정}/{카드}/{파일 id}/{파일 이름}을 나눈 것 */
export interface MaterialPath {
  uid: string;
  courseId: string;
  cardId: string;
  fileId: string;
  fileName: string;
}

/** materials/ 아래의 카드 첨부 파일 위치면 나눠서 돌려주고, 아니면 null */
export function parseMaterialPath(objectName: string): MaterialPath | null {
  const parts = objectName.split("/");
  if (parts.length !== 6 || parts[0] !== "materials") return null;
  const [, uid, courseId, cardId, fileId, fileName] = parts;
  if (![uid, courseId, cardId, fileId].every((part) => SAFE_ID.test(part))) return null;
  if (fileName.length === 0) return null;
  return { uid, courseId, cardId, fileId, fileName };
}

/** 교안 형식(PPT·PPTX·PDF)인지. 확장자의 대소문자는 가리지 않는다 */
export function isLectureFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return false;
  return LECTURE_EXTENSIONS.includes(fileName.slice(dot + 1).toLowerCase());
}

/** 알림이 너무 오래된 것인지 (eventTime: 알림이 처음 생긴 시각, ISO 문자열) */
export function isTooOld(eventTime: string, now: number): boolean {
  const created = Date.parse(eventTime);
  return Number.isFinite(created) && now - created > MAX_EVENT_AGE_MS;
}

export interface LectureUploadFacts {
  /** 경로의 uid로 팀원 명단에서 찾은 올린 사람 이메일 */
  uploaderEmail: string;
  /** 카드를 만든 사람 이메일 (cards.createdBy) */
  cardCreatedBy: string;
  cardStage: string;
  cardTrashed: boolean;
  courseTrashed: boolean;
}

export type LectureDecision =
  | { action: "skip"; reason: string }
  | { action: "record"; move: boolean };

/**
 * 올린 사람이 카드 작성자일 때만 처리한다. 휴지통 과정·카드는 건드리지 않는다.
 * 카드가 '고객사 요청 확인'·'교안' 단계면 옮기고, 다른 단계면 옮기지 않고 기록만 남긴다.
 * skip의 reason은 서버 로그에 남기는 한국어 문장이다.
 */
export function decideLectureUpload(facts: LectureUploadFacts): LectureDecision {
  if (facts.courseTrashed) return { action: "skip", reason: "휴지통에 있는 과정이라 건너뜁니다" };
  if (facts.cardTrashed) return { action: "skip", reason: "휴지통에 있는 카드라 건너뜁니다" };
  if (facts.uploaderEmail.trim().toLowerCase() !== facts.cardCreatedBy.trim().toLowerCase()) {
    return { action: "skip", reason: "올린 사람이 카드를 만든 사람이 아니라 건너뜁니다" };
  }
  return { action: "record", move: MOVE_FROM_STAGES.includes(facts.cardStage) };
}

/** 단계 맨 아래 자리 (lib/domain/ordering.ts의 orderAtEnd와 같다) */
export function orderAtEnd(orders: readonly number[]): number {
  if (orders.length === 0) return ORDER_STEP;
  return Math.max(...orders) + ORDER_STEP;
}

/** 활동 기록 문서 id. 파일 id가 올릴 때마다 새로 만들어지므로 같은 알림이 두 번 와도 같은 id가 된다 */
export function activityIdFor(fileId: string): string {
  return `lecture-${fileId}`;
}

/** 화면에 보일 이름: 구글 이름이 없으면 이메일 앞부분 */
export function displayNameOf(displayName: unknown, email: string): string {
  if (typeof displayName === "string" && displayName.trim().length > 0) return displayName.trim();
  return email.split("@")[0] ?? email;
}

export function stageLabelOf(stageId: string): string {
  return STAGE_LABELS[stageId] ?? stageId;
}

/** 최근 활동에 보이는 한국어 문장 */
export function activityMessage(input: {
  actorName: string;
  fileName: string;
  cardTitle: string;
  fromStage: string;
  moved: boolean;
}): string {
  const { actorName, fileName, cardTitle, fromStage, moved } = input;
  if (moved) {
    return `${actorName}님이 「${fileName}」 교안을 올려 '${cardTitle}' 카드를 '${stageLabelOf(fromStage)}'에서 '${stageLabelOf(MOVE_TO_STAGE)}'로 옮겼습니다.`;
  }
  return `${actorName}님이 '${cardTitle}' 카드에 「${fileName}」 교안을 올렸습니다.`;
}
