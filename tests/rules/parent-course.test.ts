// 요구사항: 하위 문서(카드·체크리스트·회차)는 부모 과정 상태를 따른다
// - 휴지통에 있는 과정은 관리자만 고친다. 그 아래 카드·체크리스트·회차도 마찬가지다.
// - 없는 과정 아래에는 카드·체크리스트·회차를 만들 수 없다.
// 과정과 하위 문서를 한 묶음으로 만드는 경우는 courses.test.ts의 "과정 만들기 묶음 쓰기"가 검사한다.

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { ADMIN, BOOTSTRAP_EMAIL, CARD_ID, TEACHER, TEACHER2, TRASHED_COURSE_ID } from "./support/constants";
import { newCard, newChecklistItem, newSession, touch } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();
const MISSING_COURSE_ID = "course-missing";

function trashedPath(db: Firestore, collectionName: string, id: string) {
  return doc(db, "courses", TRASHED_COURSE_ID, collectionName, id);
}

/** 휴지통 과정 아래에 회차·체크리스트를 미리 심는다 (기본 데이터에는 카드 1장만 있다) */
async function seedTrashedChildren() {
  await rules.privileged(async (db) => {
    await setDoc(trashedPath(db, "sessions", "trashed-session"), newSession(TEACHER));
    await setDoc(trashedPath(db, "checklistItems", "trashed-item"), newChecklistItem(TEACHER, CARD_ID));
  });
}

describe("휴지통에 있는 과정의 하위 문서", () => {
  it("강사는 카드를 고치거나 휴지통 표시를 할 수 없다", async () => {
    const db = rules.as(TEACHER2);
    await assertFails(updateDoc(trashedPath(db, "cards", CARD_ID), { title: "몰래 고친 제목", ...touch(TEACHER2) }));
    await assertFails(
      updateDoc(trashedPath(db, "cards", CARD_ID), {
        deletedAt: serverTimestamp(),
        deletedBy: TEACHER2,
        ...touch(TEACHER2),
      }),
    );
  });

  it("강사는 카드·체크리스트·회차를 새로 만들 수 없다", async () => {
    const db = rules.as(TEACHER2);
    await assertFails(setDoc(trashedPath(db, "cards", "card-new"), newCard(TEACHER2)));
    await assertFails(setDoc(trashedPath(db, "checklistItems", "item-new"), newChecklistItem(TEACHER2, CARD_ID)));
    await assertFails(setDoc(trashedPath(db, "sessions", "session-new"), newSession(TEACHER2)));
  });

  it("강사는 회차·체크리스트를 고치거나 지울 수 없다", async () => {
    await seedTrashedChildren();
    const db = rules.as(TEACHER2);
    await assertFails(updateDoc(trashedPath(db, "sessions", "trashed-session"), { location: "온라인", ...touch(TEACHER2) }));
    await assertFails(deleteDoc(trashedPath(db, "sessions", "trashed-session")));
    await assertFails(updateDoc(trashedPath(db, "checklistItems", "trashed-item"), { done: true, ...touch(TEACHER2) }));
    await assertFails(deleteDoc(trashedPath(db, "checklistItems", "trashed-item")));
  });

  it("강사도 읽기는 할 수 있다 (화면은 휴지통 과정을 열지 않지만 규칙상 읽기는 팀원 모두)", async () => {
    await assertSucceeds(getDoc(trashedPath(rules.as(TEACHER2), "cards", CARD_ID)));
  });

  it("관리자는 카드·회차·체크리스트를 고치고 지울 수 있다", async () => {
    await seedTrashedChildren();
    const db = rules.as(ADMIN);
    await assertSucceeds(updateDoc(trashedPath(db, "cards", CARD_ID), { title: "관리자가 고친 제목", ...touch(ADMIN) }));
    await assertSucceeds(setDoc(trashedPath(db, "cards", "card-admin"), newCard(ADMIN)));
    await assertSucceeds(updateDoc(trashedPath(db, "sessions", "trashed-session"), { location: "온라인", ...touch(ADMIN) }));
    await assertSucceeds(deleteDoc(trashedPath(db, "checklistItems", "trashed-item")));
  });

  it("첫 관리자(자기 문서가 아직 없음)도 고칠 수 있다", async () => {
    const db = rules.as(BOOTSTRAP_EMAIL);
    await assertSucceeds(
      updateDoc(trashedPath(db, "cards", CARD_ID), { title: "첫 관리자가 고친 제목", ...touch(BOOTSTRAP_EMAIL) }),
    );
  });

  it("관리자가 과정을 되살리면 강사도 다시 고칠 수 있다", async () => {
    await assertSucceeds(
      updateDoc(doc(rules.as(ADMIN), "courses", TRASHED_COURSE_ID), {
        deletedAt: null,
        deletedBy: null,
        ...touch(ADMIN),
      }),
    );
    await assertSucceeds(
      updateDoc(trashedPath(rules.as(TEACHER2), "cards", CARD_ID), { title: "되살린 뒤 고친 제목", ...touch(TEACHER2) }),
    );
  });
});

describe("없는 과정 아래", () => {
  function missingPath(db: Firestore, collectionName: string, id: string) {
    return doc(db, "courses", MISSING_COURSE_ID, collectionName, id);
  }

  it("강사는 카드·체크리스트·회차를 만들 수 없다", async () => {
    const db = rules.as(TEACHER2);
    await assertFails(setDoc(missingPath(db, "cards", "card-new"), newCard(TEACHER2)));
    await assertFails(setDoc(missingPath(db, "checklistItems", "item-new"), newChecklistItem(TEACHER2, "card-x")));
    await assertFails(setDoc(missingPath(db, "sessions", "session-new"), newSession(TEACHER2)));
  });

  it("관리자도 만들 수 없다", async () => {
    const db = rules.as(ADMIN);
    await assertFails(setDoc(missingPath(db, "cards", "card-new"), newCard(ADMIN)));
    await assertFails(setDoc(missingPath(db, "sessions", "session-new"), newSession(ADMIN)));
  });
});
