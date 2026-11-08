// 요구사항: 재료함(F4), AI 초안(F6), 결과물(F7), 리허설·회의 일정(F8)
// - 팀원만 읽고 쓴다. 휴지통 과정 아래에는 강사가 쓸 수 없다 (courseWritable)
// - 재료: 글 재료는 본문 필수·주소 없음, 링크는 http(s) 주소 필수. 종류는 못 바꾼다. 완전 삭제는 막는다
// - 초안: 내용만 고친다. 옛 판 정리를 위해 지울 수 있다
// - 결과물: 확정한 내용은 고칠 수 없다. 최종본 링크·표시·휴지통만 바꾼다. 완전 삭제는 막는다
// - 일정: 회차처럼 만들고 고치고 지운다

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { COURSE_ID, koreanText, STRANGER, TEACHER, TEACHER2, TRASHED_COURSE_ID } from "./support/constants";
import { createStamp, touch, withoutField, type Fields } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function ref(db: Firestore, name: string, id: string, courseId = COURSE_ID) {
  return doc(db, "courses", courseId, name, id);
}

/** createMaterial이 보내는 재료 문서 */
function newMaterial(actor: string, overrides: Fields = {}): Fields {
  return {
    kind: "text",
    title: "킥오프 회의록",
    body: "고객사 요구: 실무 중심",
    url: "",
    stage: "request",
    memo: "",
    excludeFromAi: false,
    deletedAt: null,
    deletedBy: null,
    ...createStamp(actor),
    ...overrides,
  };
}

/** createDraftVersion이 보내는 초안 문서 */
function newDraft(actor: string, overrides: Fields = {}): Fields {
  return {
    kind: "curriculum",
    version: 1,
    content: "# 커리큘럼",
    request: "",
    materialIds: ["m1"],
    ...createStamp(actor),
    ...overrides,
  };
}

/** confirmDraft가 보내는 결과물 문서 */
function newOutput(actor: string, overrides: Fields = {}): Fields {
  return {
    kind: "slides",
    version: 1,
    content: "## 첫 장",
    sourceDraftId: "draft-1",
    finalUrl: "",
    isFinal: false,
    deletedAt: null,
    deletedBy: null,
    ...createStamp(actor),
    ...overrides,
  };
}

/** createEvent가 보내는 일정 문서 */
function newEvent(actor: string, overrides: Fields = {}): Fields {
  return {
    kind: "rehearsal",
    title: "전체 리허설",
    date: "2026-10-19",
    startTime: "14:00",
    note: "",
    ...createStamp(actor),
    ...overrides,
  };
}

describe("재료", () => {
  it("팀원은 글·받아쓰기·링크 재료를 만들고 읽는다", async () => {
    const db = rules.as(TEACHER);
    await assertSucceeds(setDoc(ref(db, "materials", "m-text"), newMaterial(TEACHER)));
    await assertSucceeds(setDoc(ref(db, "materials", "m-dict"), newMaterial(TEACHER, { kind: "dictation", stage: null })));
    await assertSucceeds(
      setDoc(
        ref(db, "materials", "m-link"),
        newMaterial(TEACHER, { kind: "link", body: "", url: "https://drive.google.com/file/d/abc" }),
      ),
    );
    await assertSucceeds(setDoc(ref(db, "materials", "m-long"), newMaterial(TEACHER, { body: koreanText(100000) })));
  });

  it("팀원이 아니면 읽지도 쓰지도 못한다", async () => {
    await rules.privileged((db) => setDoc(ref(db, "materials", "m-seed"), newMaterial(TEACHER)));
    const db = rules.as(STRANGER);
    await assertFails(setDoc(ref(db, "materials", "m-x"), newMaterial(STRANGER)));
    await assertFails(getDoc(ref(db, "materials", "m-seed")));
  });

  it.each<[string, Fields]>([
    ["글 재료에 본문이 없음", { body: "" }],
    ["글 재료에 주소가 있음", { url: "https://example.com" }],
    ["링크에 주소가 없음", { kind: "link", body: "", url: "" }],
    ["링크가 http(s)가 아님", { kind: "link", url: "javascript:alert(1)" }],
    ["링크 주소에 공백", { kind: "link", url: "https://exa mple.com" }],
    ["모르는 종류", { kind: "file" }],
    ["모르는 단계", { stage: "unknown" }],
    ["제목 없음", { title: "" }],
    ["본문이 너무 김", { body: koreanText(100001) }],
    ["메모가 너무 김", { memo: koreanText(2001) }],
    ["AI 제외가 글자", { excludeFromAi: "yes" }],
    ["휴지통 상태로 만듦", { deletedAt: serverTimestamp(), deletedBy: TEACHER }],
    ["모르는 칸", { fileData: "base64…" }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(ref(rules.as(TEACHER), "materials", "m-bad"), newMaterial(TEACHER, overrides)));
  });

  it("빠진 칸이 있으면 막힌다", async () => {
    await assertFails(
      setDoc(ref(rules.as(TEACHER), "materials", "m-missing"), withoutField(newMaterial(TEACHER), "excludeFromAi")),
    );
  });

  it("고치기·휴지통·되살리기는 되고, 종류 바꾸기와 완전 삭제는 막힌다", async () => {
    await rules.privileged((db) => setDoc(ref(db, "materials", "m-edit"), newMaterial(TEACHER)));
    const db = rules.as(TEACHER2);
    const target = ref(db, "materials", "m-edit");
    await assertSucceeds(updateDoc(target, { title: "고친 제목", excludeFromAi: true, ...touch(TEACHER2) }));
    await assertFails(updateDoc(target, { kind: "dictation", ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(target, { deletedAt: serverTimestamp(), deletedBy: TEACHER2, ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(target, { deletedAt: null, deletedBy: null, ...touch(TEACHER2) }));
    await assertFails(deleteDoc(target));
  });

  it("휴지통 과정 아래에는 강사가 재료를 만들 수 없다", async () => {
    await assertFails(setDoc(ref(rules.as(TEACHER), "materials", "m-t", TRASHED_COURSE_ID), newMaterial(TEACHER)));
  });
});

describe("초안", () => {
  it("팀원은 초안을 만들고 내용을 고치고 지운다", async () => {
    const db = rules.as(TEACHER);
    const target = ref(db, "drafts", "d-1");
    await assertSucceeds(setDoc(target, newDraft(TEACHER)));
    await assertSucceeds(updateDoc(target, { content: "# 고친 커리큘럼", ...touch(TEACHER) }));
    await assertSucceeds(deleteDoc(target));
  });

  it.each<[string, Fields]>([
    ["모르는 종류", { kind: "quiz" }],
    ["판 번호 0", { version: 0 }],
    ["판 번호가 소수", { version: 1.5 }],
    ["내용 없음", { content: "" }],
    ["내용이 너무 김", { content: koreanText(100001) }],
    ["추가 요청이 너무 김", { request: koreanText(2001) }],
    ["재료가 51개", { materialIds: Array.from({ length: 51 }, (_, index) => `m${index}`) }],
    ["재료 목록이 글자", { materialIds: "m1" }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(ref(rules.as(TEACHER), "drafts", "d-bad"), newDraft(TEACHER, overrides)));
  });

  it("내용 말고 다른 칸(종류·판 번호)은 못 고친다", async () => {
    await rules.privileged((db) => setDoc(ref(db, "drafts", "d-fixed"), newDraft(TEACHER)));
    const target = ref(rules.as(TEACHER), "drafts", "d-fixed");
    await assertFails(updateDoc(target, { version: 5, ...touch(TEACHER) }));
    await assertFails(updateDoc(target, { kind: "lab", ...touch(TEACHER) }));
  });
});

describe("결과물", () => {
  it("팀원은 확정한 결과물을 만들고, 최종본 링크·표시·휴지통을 바꾼다", async () => {
    const db = rules.as(TEACHER);
    const target = ref(db, "outputs", "o-1");
    await assertSucceeds(setDoc(target, newOutput(TEACHER)));
    await assertSucceeds(updateDoc(target, { finalUrl: "https://drive.google.com/x", isFinal: true, ...touch(TEACHER) }));
    await assertSucceeds(updateDoc(target, { finalUrl: "", ...touch(TEACHER) }));
    await assertSucceeds(
      updateDoc(target, { deletedAt: serverTimestamp(), deletedBy: TEACHER, isFinal: false, ...touch(TEACHER) }),
    );
  });

  it("확정한 내용은 고칠 수 없고, 완전 삭제도 막힌다", async () => {
    await rules.privileged((db) => setDoc(ref(db, "outputs", "o-fixed"), newOutput(TEACHER)));
    const target = ref(rules.as(TEACHER2), "outputs", "o-fixed");
    await assertFails(updateDoc(target, { content: "몰래 고친 내용", ...touch(TEACHER2) }));
    await assertFails(updateDoc(target, { version: 9, ...touch(TEACHER2) }));
    await assertFails(updateDoc(target, { finalUrl: "ftp://example.com", ...touch(TEACHER2) }));
    await assertFails(deleteDoc(target));
  });

  it.each<[string, Fields]>([
    ["처음부터 최종본", { isFinal: true }],
    ["처음부터 링크", { finalUrl: "https://example.com" }],
    ["원래 초안 id 없음", { sourceDraftId: "" }],
    ["모르는 종류", { kind: "quiz" }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(ref(rules.as(TEACHER), "outputs", "o-bad"), newOutput(TEACHER, overrides)));
  });
});

describe("일정 (리허설·회의)", () => {
  it("팀원은 일정을 만들고 고치고 지운다", async () => {
    const db = rules.as(TEACHER);
    const target = ref(db, "events", "e-1");
    await assertSucceeds(setDoc(target, newEvent(TEACHER)));
    await assertSucceeds(setDoc(ref(db, "events", "e-2"), newEvent(TEACHER, { kind: "meeting", startTime: null })));
    await assertSucceeds(updateDoc(target, { kind: "meeting", title: "고객사 회의", ...touch(TEACHER) }));
    await assertSucceeds(deleteDoc(target));
  });

  it.each<[string, Fields]>([
    ["모르는 종류", { kind: "party" }],
    ["이름 없음", { title: "" }],
    ["없는 날짜", { date: "2026-02-30" }],
    ["시간 형식", { startTime: "9시" }],
    ["메모가 너무 김", { note: koreanText(1001) }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(ref(rules.as(TEACHER), "events", "e-bad"), newEvent(TEACHER, overrides)));
  });

  it("팀원이 아니면 막힌다", async () => {
    await assertFails(setDoc(ref(rules.as(STRANGER), "events", "e-x"), newEvent(STRANGER)));
  });
});
