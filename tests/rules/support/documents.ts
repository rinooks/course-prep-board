// 규칙 테스트용 문서 모양. lib/data/*가 실제로 보내는 값과 같은 모양으로 만든다.
// overrides로 칸 하나만 바꿔 "그 칸 때문에" 막히는지 확인한다.

import { serverTimestamp } from "firebase/firestore";
import { BOOTSTRAP_EMAIL, uidOf } from "./constants";

export type Fields = Record<string, unknown>;

/** 만들 때 남기는 작성자·시각 도장 */
export function createStamp(actor: string): Fields {
  return {
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };
}

/** 고칠 때 남기는 수정자·시각 도장 */
export function touch(actor: string): Fields {
  return { updatedAt: serverTimestamp(), updatedBy: actor };
}

/** createCourse가 보내는 과정 문서 */
export function newCourse(actor: string, overrides: Fields = {}): Fields {
  return {
    title: "A사 신입사원 AI 활용 과정",
    client: "A사",
    description: "",
    instructorEmails: [actor],
    status: "active",
    deletedAt: null,
    deletedBy: null,
    ...createStamp(actor),
    ...overrides,
  };
}

/** createCard가 보내는 카드 문서 */
export function newCard(actor: string, overrides: Fields = {}): Fields {
  return {
    stage: "request",
    title: "교육 정보 확인",
    order: 1024,
    assigneeEmail: null,
    dueDate: null,
    memo: "",
    done: false,
    deletedAt: null,
    deletedBy: null,
    ...createStamp(actor),
    ...overrides,
  };
}

/** createChecklistItem이 보내는 체크리스트 항목 문서 */
export function newChecklistItem(actor: string, cardId: string, overrides: Fields = {}): Fields {
  return {
    cardId,
    text: "교육 대상 확인",
    done: false,
    order: 1024,
    ...createStamp(actor),
    ...overrides,
  };
}

/** saveCardFileRecord가 보내는 첨부 파일 목록 문서 (저장 위치는 올린 사람 uid·과정·카드·문서 id·이름과 맞춘다) */
export function newCardFile(
  actor: string,
  courseId: string,
  fileId: string,
  cardId: string,
  overrides: Fields = {},
): Fields {
  const name = typeof overrides.name === "string" ? overrides.name : "교안 초안.pdf";
  return {
    cardId,
    name,
    size: 2048,
    contentType: "application/pdf",
    storagePath: `materials/${uidOf(actor)}/${courseId}/${cardId}/${fileId}/${name}`,
    ...createStamp(actor),
    ...overrides,
  };
}

/** createSession이 보내는 회차 문서 */
export function newSession(actor: string, overrides: Fields = {}): Fields {
  return {
    date: "2026-10-20",
    startTime: "09:30",
    location: "본사 3층 교육장",
    audience: "신입사원 30명",
    note: "",
    ...createStamp(actor),
    ...overrides,
  };
}

/** inviteMember가 보내는 초대 문서 */
export function invitation(email: string, invitedBy: string, overrides: Fields = {}): Fields {
  return {
    email,
    role: "instructor",
    displayName: "",
    photoURL: "",
    uid: null,
    invitedBy,
    invitedAt: serverTimestamp(),
    lastLoginAt: null,
    ...overrides,
  };
}

/** linkMemberProfile이 로그인할 때 보내는 프로필 갱신 */
export function profileUpdate(email: string, overrides: Fields = {}): Fields {
  return {
    uid: uidOf(email),
    displayName: "김강사",
    photoURL: "https://lh3.googleusercontent.com/a/photo.png",
    lastLoginAt: serverTimestamp(),
    ...overrides,
  };
}

/** createBootstrapAdmin이 첫 관리자의 첫 로그인 때 보내는 문서 (email은 자기 경로와 같게) */
export function selfMemberDoc(email: string, overrides: Fields = {}): Fields {
  return {
    email,
    role: "admin",
    invitedBy: email,
    invitedAt: serverTimestamp(),
    ...profileUpdate(email, { displayName: "관리자" }),
    ...overrides,
  };
}

/** 심어 두는 팀원 문서 (이미 초대된 상태) */
export function seededMember(email: string, role: "admin" | "instructor"): Fields {
  return invitation(email, BOOTSTRAP_EMAIL, { role });
}

/** 칸 하나를 뺀 사본 (필수 칸 검사용) */
export function withoutField(fields: Fields, key: string): Fields {
  const copy: Fields = { ...fields };
  delete copy[key];
  return copy;
}
