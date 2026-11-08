// 화면과 데이터 계층이 함께 쓰는 타입. Firebase를 import하지 않는다 (lib/domain에서도 쓴다).
// 시각(createdAt 등)은 밀리초 숫자(epoch ms)다. 방금 쓴 값은 서버 확정 전이라 추정값이 들어간다.
// 날짜(dueDate, date)는 한국 날짜 "YYYY-MM-DD" 문자열이다.

import type { StageId } from "@/lib/domain/stages";
import type { Role } from "@/lib/domain/roles";
import type { DateString } from "@/lib/domain/dates";
import type { DraftKind } from "@/lib/domain/drafts";
import type { EventKind } from "@/lib/domain/events";
import type { MaterialKind } from "@/lib/domain/materials";

export type { StageId, Role, DateString, DraftKind, EventKind, MaterialKind };

export type EpochMs = number;

/** 구독 해제 함수. useEffect 정리(cleanup)에서 꼭 호출한다. */
export type Unsubscribe = () => void;

/** 실시간 구독 오류 콜백. 받은 오류는 toUserMessage(error)로 보여준다. */
export type ErrorHandler = (error: unknown) => void;

// ---------- members/{email} ----------

export interface Member {
  /** 문서 id = 소문자 이메일 */
  email: string;
  role: Role;
  /** 첫 로그인 전에는 빈 문자열 */
  displayName: string;
  photoURL: string;
  /** 첫 로그인 전에는 null */
  uid: string | null;
  invitedBy: string;
  invitedAt: EpochMs | null;
  lastLoginAt: EpochMs | null;
}

// ---------- courses/{courseId} ----------

export type CourseStatus = "active" | "archived";

export interface Course {
  id: string;
  title: string;
  client: string;
  description: string;
  /** 담당 강사 이메일 (소문자) */
  instructorEmails: string[];
  status: CourseStatus;
  /** 휴지통에 넣은 시각. null이면 휴지통이 아님 */
  deletedAt: EpochMs | null;
  deletedBy: string | null;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/sessions/{sessionId} ----------

export interface Session {
  id: string;
  courseId: string;
  date: DateString;
  /** "HH:MM" 또는 null */
  startTime: string | null;
  location: string;
  audience: string;
  note: string;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/cards/{cardId} ----------

export interface Card {
  id: string;
  courseId: string;
  stage: StageId;
  title: string;
  /** 단계 안 순서 (소수). lib/domain/ordering.ts로 계산 */
  order: number;
  assigneeEmail: string | null;
  dueDate: DateString | null;
  memo: string;
  done: boolean;
  /** 휴지통에 넣은 시각. null이면 보드에 보임 */
  deletedAt: EpochMs | null;
  deletedBy: string | null;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/checklistItems/{itemId} ----------

export interface ChecklistItem {
  id: string;
  courseId: string;
  cardId: string;
  text: string;
  done: boolean;
  order: number;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/cardFiles/{fileId} ----------

/** 카드 첨부 파일의 목록 정보. 파일 자체는 Storage의 storagePath에 있다. 만든 뒤 고치지 않는다 */
export interface CardFile {
  id: string;
  courseId: string;
  cardId: string;
  /** 다듬은 파일 이름 (확장자 포함) */
  name: string;
  /** 바이트 */
  size: number;
  contentType: string;
  /** Storage 안 위치: materials/{올린 사람 uid}/{courseId}/{cardId}/{id}/{name} (예전 파일은 courses/{courseId}/cardFiles/{id}/{name}) */
  storagePath: string;
  createdBy: string;
  createdAt: EpochMs | null;
}

// ---------- activity/{activityId} ----------

/** 최근 활동 한 줄 (PRD F9). 서버 함수가 교안이 올라올 때 남긴다. 화면은 읽기만 한다 */
export interface Activity {
  id: string;
  courseId: string;
  cardId: string;
  /** 올린 사람 이메일 */
  actorEmail: string;
  fileName: string;
  /** 카드를 리허설 단계로 옮겼는지 */
  moved: boolean;
  /** 화면에 그대로 보여주는 한국어 문장 */
  message: string;
  createdAt: EpochMs | null;
}

// ---------- courses/{courseId}/materials/{materialId} ----------

/** 재료 (PRD F4). 파일은 저장하지 않고 글과 링크만 둔다 */
export interface Material {
  id: string;
  courseId: string;
  kind: MaterialKind;
  title: string;
  /** 붙여 넣은 글·받아쓰기 결과. 링크는 설명(비워도 됨) */
  body: string;
  /** 링크 주소. 링크가 아니면 빈 문자열 */
  url: string;
  stage: StageId | null;
  memo: string;
  /** true면 AI 요청문에 넣지 않는다 (고객사 기밀 등) */
  excludeFromAi: boolean;
  deletedAt: EpochMs | null;
  deletedBy: string | null;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/drafts/{draftId} ----------

/** AI 초안 한 판 (PRD F6). 종류별 최근 10판만 남긴다 */
export interface Draft {
  id: string;
  courseId: string;
  kind: DraftKind;
  /** 종류 안 판 번호 (1부터) */
  version: number;
  content: string;
  /** 만들 때 적은 추가 요청 */
  request: string;
  /** 요청문에 넣은 재료 id */
  materialIds: string[];
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/outputs/{outputId} ----------

/** 확정한 결과물 (PRD F7). 확정한 순간의 초안 내용을 그대로 담아 두고, 내용은 고치지 않는다 */
export interface Output {
  id: string;
  courseId: string;
  kind: DraftKind;
  /** 종류 안 판 번호 (1부터) */
  version: number;
  content: string;
  sourceDraftId: string;
  /** PowerPoint 등에서 다듬은 최종본의 링크 (구글 드라이브 등). 없으면 빈 문자열 */
  finalUrl: string;
  /** 이 판을 최종본으로 표시했는지 (종류마다 하나) */
  isFinal: boolean;
  deletedAt: EpochMs | null;
  deletedBy: string | null;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- courses/{courseId}/events/{eventId} ----------

/** 리허설·회의 같은 준비 일정 (PRD F8). 강의 회차는 sessions에 따로 있다 */
export interface CourseEvent {
  id: string;
  courseId: string;
  kind: EventKind;
  title: string;
  date: DateString;
  startTime: string | null;
  note: string;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

/** 강사료 한 건 (fees/{feeId}). 강사 본인과 관리자만 읽는다 */
export interface Fee {
  id: string;
  courseId: string;
  /** 강사료를 받는 강사 (소문자 이메일) */
  instructorEmail: string;
  /** "1회차", "선금" 같은 항목 이름. 빈 문자열이면 없음 */
  label: string;
  /** 원 단위 정수 */
  amount: number;
  dueDate: DateString;
  /** 입금일. null이면 아직 입금 전 */
  paidDate: DateString | null;
  memo: string;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

/** 고객사 (clients/{clientId}). 과정과는 이름(course.client)으로 맞춘다 */
export interface Client {
  id: string;
  name: string;
  memo: string;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

/** 고객사 담당자 (clientContacts/{contactId}) */
export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  /** 부서·직책 */
  role: string;
  phone: string;
  email: string;
  memo: string;
  createdBy: string;
  createdAt: EpochMs | null;
  updatedAt: EpochMs | null;
  updatedBy: string;
}

// ---------- 입력 타입 ----------

export interface FeeInput {
  courseId: string;
  instructorEmail: string;
  /** 원 단위 정수, 또는 "1,200,000" 같은 입력 글자 */
  amount: number | string;
  dueDate: string;
  label?: string;
  paidDate?: string | null;
  memo?: string;
}

/** 강사료 고치기. 과정·강사는 바꿀 수 없다 */
export interface FeeUpdateInput {
  label?: string;
  amount?: number | string;
  dueDate?: string;
  paidDate?: string | null;
  memo?: string;
}

export interface ClientInput {
  name: string;
  memo?: string;
}

export interface ContactInput {
  clientId: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  memo?: string;
}

/** 담당자 고치기. 어느 고객사의 담당자인지는 바꿀 수 없다 */
export type ContactUpdateInput = Partial<Omit<ContactInput, "clientId">>;

export interface MaterialInput {
  kind: MaterialKind;
  title: string;
  body?: string;
  url?: string;
  stage?: StageId | null;
  memo?: string;
  excludeFromAi?: boolean;
}

export type MaterialUpdateInput = Partial<Omit<MaterialInput, "kind">>;

export interface DraftCreateInput {
  kind: DraftKind;
  content: string;
  request?: string;
  materialIds?: string[];
}

export interface EventInput {
  kind: EventKind;
  title: string;
  date: string;
  startTime?: string | null;
  note?: string;
}

export interface SessionInput {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" 또는 빈 값 */
  startTime?: string | null;
  location?: string;
  audience?: string;
  note?: string;
}

export interface CourseCreateInput {
  title: string;
  client?: string;
  description?: string;
  instructorEmails?: string[];
  /** 함께 만들 회차들 (첫 강의 날짜 등). 비워도 된다. */
  sessions?: SessionInput[];
}

export interface CourseUpdateInput {
  title?: string;
  client?: string;
  description?: string;
  instructorEmails?: string[];
}

export interface CardCreateInput {
  stage: StageId;
  title: string;
  /** 단계 안 순서. 보통 orderAtEnd(그 단계 카드들의 order) */
  order: number;
  assigneeEmail?: string | null;
  dueDate?: string | null;
  memo?: string;
}

export interface CardUpdateInput {
  title?: string;
  assigneeEmail?: string | null;
  dueDate?: string | null;
  memo?: string;
  done?: boolean;
}

export interface ChecklistItemCreateInput {
  cardId: string;
  text: string;
  /** 카드 안 순서. 보통 orderAtEnd(그 카드 항목들의 order) */
  order: number;
}

/** 쓰기 함수 옵션. id를 미리 만들어 두면 "다시 시도" 때 같은 문서로 저장된다. */
export interface CreateOptions {
  id?: string;
}
