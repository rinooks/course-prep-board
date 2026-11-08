// 접근 검사에 쓰는 작업 목록. 같은 목록을
// - 초대된 팀원·관리자로 돌려 "통과"하는지 (대조군: 문서 모양은 올바르다는 증거)
// - 로그인 안 함·이메일 미인증·초대받지 않은 사람으로 돌려 "막히는지"
// 확인한다. 그래서 막힌 이유가 문서 모양이 아니라 "누가 했는지"임이 보장된다.
// actor는 작성자 도장에 들어갈 소문자 이메일이다.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  CARD_ID,
  COURSE_ID,
  ITEM_ID,
  NEWCOMER,
  SESSION_ID,
  TEACHER,
  TEACHER2,
  TRASHED_COURSE_ID,
} from "./constants";
import { invitation, newCard, newChecklistItem, newCourse, newSession, touch } from "./documents";

export interface Operation {
  name: string;
  run: (db: Firestore, actor: string) => Promise<unknown>;
}

/** 팀원이면 누구나 할 수 있는 읽기 */
export const MEMBER_READS: Operation[] = [
  { name: "다른 팀원 문서 읽기", run: (db) => getDoc(doc(db, "members", TEACHER2)) },
  { name: "팀원 목록 읽기", run: (db) => getDocs(collection(db, "members")) },
  { name: "과정 하나 읽기", run: (db) => getDoc(doc(db, "courses", COURSE_ID)) },
  { name: "과정 목록 읽기", run: (db) => getDocs(collection(db, "courses")) },
  {
    name: "진행 중 과정 질의 (홈)",
    run: (db) =>
      getDocs(query(collection(db, "courses"), where("status", "==", "active"), where("deletedAt", "==", null))),
  },
  {
    name: "휴지통 과정 질의",
    run: (db) => getDocs(query(collection(db, "courses"), where("deletedAt", "!=", null))),
  },
  { name: "카드 하나 읽기", run: (db) => getDoc(doc(db, "courses", COURSE_ID, "cards", CARD_ID)) },
  { name: "카드 목록 읽기", run: (db) => getDocs(collection(db, "courses", COURSE_ID, "cards")) },
  {
    name: "체크리스트 항목 읽기",
    run: (db) => getDoc(doc(db, "courses", COURSE_ID, "checklistItems", ITEM_ID)),
  },
  {
    name: "체크리스트 목록 읽기",
    run: (db) => getDocs(collection(db, "courses", COURSE_ID, "checklistItems")),
  },
  { name: "회차 하나 읽기", run: (db) => getDoc(doc(db, "courses", COURSE_ID, "sessions", SESSION_ID)) },
  { name: "회차 목록 읽기", run: (db) => getDocs(collection(db, "courses", COURSE_ID, "sessions")) },
];

/** 팀원이면 누구나 할 수 있는 쓰기 (가정 A3: 모든 팀원이 모든 과정을 고친다) */
export const MEMBER_WRITES: Operation[] = [
  { name: "과정 만들기", run: (db, actor) => setDoc(doc(db, "courses", "course-new"), newCourse(actor)) },
  {
    name: "과정 정보 고치기",
    run: (db, actor) => updateDoc(doc(db, "courses", COURSE_ID), { title: "바꾼 과정 이름", ...touch(actor) }),
  },
  {
    name: "과정 보관",
    run: (db, actor) => updateDoc(doc(db, "courses", COURSE_ID), { status: "archived", ...touch(actor) }),
  },
  {
    name: "카드 만들기",
    run: (db, actor) => setDoc(doc(db, "courses", COURSE_ID, "cards", "card-new"), newCard(actor)),
  },
  {
    name: "카드 고치기",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", COURSE_ID, "cards", CARD_ID), { done: true, ...touch(actor) }),
  },
  {
    name: "카드 휴지통 표시",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", COURSE_ID, "cards", CARD_ID), {
        deletedAt: serverTimestamp(),
        deletedBy: actor,
        ...touch(actor),
      }),
  },
  {
    name: "체크리스트 항목 만들기",
    run: (db, actor) =>
      setDoc(doc(db, "courses", COURSE_ID, "checklistItems", "item-new"), newChecklistItem(actor, CARD_ID)),
  },
  {
    name: "체크리스트 체크",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", COURSE_ID, "checklistItems", ITEM_ID), { done: true, ...touch(actor) }),
  },
  {
    name: "체크리스트 항목 지우기",
    run: (db) => deleteDoc(doc(db, "courses", COURSE_ID, "checklistItems", ITEM_ID)),
  },
  {
    name: "회차 만들기",
    run: (db, actor) => setDoc(doc(db, "courses", COURSE_ID, "sessions", "session-new"), newSession(actor)),
  },
  {
    name: "회차 고치기",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", COURSE_ID, "sessions", SESSION_ID), { location: "온라인", ...touch(actor) }),
  },
  { name: "회차 지우기", run: (db) => deleteDoc(doc(db, "courses", COURSE_ID, "sessions", SESSION_ID)) },
];

/** 관리자만 할 수 있는 쓰기 */
export const ADMIN_WRITES: Operation[] = [
  {
    name: "강사 초대",
    run: (db, actor) => setDoc(doc(db, "members", NEWCOMER), invitation(NEWCOMER, actor)),
  },
  { name: "역할 바꾸기", run: (db) => updateDoc(doc(db, "members", TEACHER), { role: "admin" }) },
  { name: "팀원 내보내기", run: (db) => deleteDoc(doc(db, "members", TEACHER2)) },
  {
    name: "과정 휴지통에 넣기",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", COURSE_ID), { deletedAt: serverTimestamp(), deletedBy: actor, ...touch(actor) }),
  },
  {
    name: "과정 되살리기",
    run: (db, actor) =>
      updateDoc(doc(db, "courses", TRASHED_COURSE_ID), { deletedAt: null, deletedBy: null, ...touch(actor) }),
  },
];

/** 누구도 할 수 없는 쓰기 (지우기는 휴지통 표시로만 한다) */
export const FORBIDDEN_WRITES: Operation[] = [
  { name: "카드 완전 삭제", run: (db) => deleteDoc(doc(db, "courses", COURSE_ID, "cards", CARD_ID)) },
  { name: "과정 완전 삭제", run: (db) => deleteDoc(doc(db, "courses", COURSE_ID)) },
];

export const ALL_OPERATIONS: Operation[] = [
  ...MEMBER_READS,
  ...MEMBER_WRITES,
  ...ADMIN_WRITES,
  ...FORBIDDEN_WRITES,
];
