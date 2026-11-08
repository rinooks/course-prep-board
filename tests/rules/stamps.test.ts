// 요구사항: 작성자·시각 도장 (과정·카드·체크리스트 항목·회차 공통)
// - 만들 때 createdBy·updatedBy는 요청한 본인, createdAt·updatedAt은 서버 시각이어야 한다
// - 고칠 때 createdBy·createdAt은 바꿀 수 없고, updatedBy는 본인·updatedAt은 서버 시각이어야 한다
// 신원은 요청 본문이 아니라 로그인 토큰에서 온다는 원칙을 확인한다.

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { CARD_ID, COURSE_ID, ITEM_ID, SESSION_ID, TEACHER, TEACHER2 } from "./support/constants";
import {
  newCard,
  newChecklistItem,
  newCourse,
  newSession,
  touch,
  type Fields,
} from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";
import { docAt, type PathSegments } from "./support/paths";

const rules = setupRulesEnvironment();

interface StampedCollection {
  name: string;
  newPath: PathSegments;
  existingPath: PathSegments;
  build: (actor: string, overrides?: Fields) => Fields;
  patch: Fields;
}

const COLLECTIONS: StampedCollection[] = [
  {
    name: "과정",
    newPath: ["courses", "course-new"],
    existingPath: ["courses", COURSE_ID],
    build: (actor, overrides) => newCourse(actor, overrides),
    patch: { title: "바꾼 과정 이름" },
  },
  {
    name: "카드",
    newPath: ["courses", COURSE_ID, "cards", "card-new"],
    existingPath: ["courses", COURSE_ID, "cards", CARD_ID],
    build: (actor, overrides) => newCard(actor, overrides),
    patch: { title: "바꾼 카드 제목" },
  },
  {
    name: "체크리스트 항목",
    newPath: ["courses", COURSE_ID, "checklistItems", "item-new"],
    existingPath: ["courses", COURSE_ID, "checklistItems", ITEM_ID],
    build: (actor, overrides) => newChecklistItem(actor, CARD_ID, overrides),
    patch: { text: "바꾼 항목" },
  },
  {
    name: "회차",
    newPath: ["courses", COURSE_ID, "sessions", "session-new"],
    existingPath: ["courses", COURSE_ID, "sessions", SESSION_ID],
    build: (actor, overrides) => newSession(actor, overrides),
    patch: { location: "온라인" },
  },
];

describe.each(COLLECTIONS)("$name 도장", ({ newPath, existingPath, build, patch }) => {
  // 기본 데이터는 TEACHER가 만들었다. 다른 강사 TEACHER2가 만들고 고친다.
  const actor = TEACHER2;

  it("대조군: 본인·서버 시각 도장이면 만들고 고친다", async () => {
    const db = rules.as(actor);
    await assertSucceeds(setDoc(docAt(db, newPath), build(actor)));
    await assertSucceeds(updateDoc(docAt(db, existingPath), { ...patch, ...touch(actor) }));
  });

  it("만들 때 createdBy가 본인이 아니면 막힌다", async () => {
    await assertFails(setDoc(docAt(rules.as(actor), newPath), build(actor, { createdBy: TEACHER })));
  });

  it("만들 때 updatedBy가 본인이 아니면 막힌다", async () => {
    await assertFails(setDoc(docAt(rules.as(actor), newPath), build(actor, { updatedBy: TEACHER })));
  });

  it("만들 때 createdAt·updatedAt을 지어내면(과거 시각) 막힌다", async () => {
    const db = rules.as(actor);
    await assertFails(setDoc(docAt(db, newPath), build(actor, { createdAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(docAt(db, newPath), build(actor, { updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(docAt(db, newPath), build(actor, { createdAt: "2026-10-11" })));
  });

  it("고칠 때 createdBy를 바꾸면 막힌다 (본인으로든 남으로든)", async () => {
    const db = rules.as(actor);
    await assertFails(updateDoc(docAt(db, existingPath), { createdBy: actor, ...touch(actor) }));
    await assertFails(updateDoc(docAt(db, existingPath), { createdBy: "someone@example.com", ...touch(actor) }));
  });

  it("고칠 때 createdAt을 바꾸면 막힌다", async () => {
    const db = rules.as(actor);
    await assertFails(updateDoc(docAt(db, existingPath), { createdAt: serverTimestamp(), ...touch(actor) }));
    await assertFails(updateDoc(docAt(db, existingPath), { createdAt: Timestamp.fromMillis(0), ...touch(actor) }));
  });

  it("고칠 때 createdBy·createdAt을 지우면 막힌다", async () => {
    const db = rules.as(actor);
    await assertFails(updateDoc(docAt(db, existingPath), { createdBy: deleteField(), ...touch(actor) }));
    await assertFails(updateDoc(docAt(db, existingPath), { createdAt: deleteField(), ...touch(actor) }));
  });

  it("고칠 때 updatedBy가 본인이 아니거나, 도장을 빼거나, 시각을 지어내면 막힌다", async () => {
    const db = rules.as(actor);
    const ref = docAt(db, existingPath);
    await assertFails(updateDoc(ref, { ...patch, updatedAt: serverTimestamp(), updatedBy: TEACHER }));
    await assertFails(updateDoc(ref, { ...patch }));
    await assertFails(updateDoc(ref, { ...patch, updatedBy: actor }));
    await assertFails(updateDoc(ref, { ...patch, updatedAt: Timestamp.fromMillis(0), updatedBy: actor }));
  });
});
