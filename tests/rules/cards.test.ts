// 요구사항: 카드(courses/{id}/cards/{cardId})
// - 팀원은 올바른 카드를 만들고 읽고 고친다 (담당자·마감일·메모·완료, 단계 이동·순서 바꾸기, 휴지통 표시·되살리기)
// - 검증: 잘못된 타입, 빠진 칸, 너무 긴 글, 잘못된 단계(stage) 값, 모르는 칸은 막힌다
// 작성자·시각 도장은 stamps.test.ts에서 검사한다.

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  CARD_ID,
  COURSE_ID,
  koreanText,
  LIMIT,
  SECOND_CARD_ID,
  TEACHER,
  TEACHER2,
  TRASHED_CARD_ID,
} from "./support/constants";
import { newCard, touch, withoutField } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function cardRef(db: Firestore, cardId: string) {
  return doc(db, "courses", COURSE_ID, "cards", cardId);
}

const STAGES = ["request", "curriculum", "lecture", "practice", "rehearsal", "dayof", "survey"];

describe("팀원의 카드 만들기·고치기", () => {
  it.each(STAGES)("단계 %s에 카드를 만든다 (createCard와 같은 모양)", async (stage) => {
    const db = rules.as(TEACHER2);
    await assertSucceeds(
      setDoc(
        cardRef(db, `card-${stage}`),
        newCard(TEACHER2, { stage, assigneeEmail: TEACHER, dueDate: "2026-10-30", memo: "고객사 담당자 연락처 확인" }),
      ),
    );
  });

  it("길이 제한 끝값(제목 200자·메모 5000자)은 통과한다", async () => {
    await assertSucceeds(
      setDoc(
        cardRef(rules.as(TEACHER2), "card-long"),
        newCard(TEACHER2, { title: koreanText(LIMIT.cardTitle), memo: koreanText(LIMIT.cardMemo) }),
      ),
    );
  });

  it("만든 사람이 아닌 강사도 제목·담당자·마감일·메모·완료를 고친다 (updateCard와 같은 모양)", async () => {
    const db = rules.as(TEACHER2);
    await assertSucceeds(
      updateDoc(cardRef(db, CARD_ID), {
        title: "교육 정보 다시 확인",
        assigneeEmail: TEACHER2,
        dueDate: "2026-10-25",
        memo: "담당자: 김과장",
        done: true,
        ...touch(TEACHER2),
      }),
    );
    await assertSucceeds(
      updateDoc(cardRef(db, CARD_ID), { assigneeEmail: null, dueDate: null, done: false, ...touch(TEACHER2) }),
    );
  });

  it("다른 단계로 옮긴다 (moveCard 한 장)", async () => {
    await assertSucceeds(
      updateDoc(cardRef(rules.as(TEACHER2), CARD_ID), { stage: "lecture", order: 512.5, ...touch(TEACHER2) }),
    );
  });

  it("옮기면서 그 단계 순서를 한 번에 다시 매긴다 (moveCard 묶음 쓰기)", async () => {
    const db = rules.as(TEACHER2);
    const batch = writeBatch(db);
    batch.update(cardRef(db, SECOND_CARD_ID), { stage: "request", order: 1024, ...touch(TEACHER2) });
    batch.update(cardRef(db, CARD_ID), { order: 2048, ...touch(TEACHER2) });
    await assertSucceeds(batch.commit());
  });

  it("휴지통에 넣고 되살린다 (softDeleteCard·restoreCard, 팀원 누구나)", async () => {
    const db = rules.as(TEACHER2);
    await assertSucceeds(
      updateDoc(cardRef(db, CARD_ID), { deletedAt: serverTimestamp(), deletedBy: TEACHER2, ...touch(TEACHER2) }),
    );
    await assertSucceeds(
      updateDoc(cardRef(db, TRASHED_CARD_ID), { deletedAt: null, deletedBy: null, ...touch(TEACHER2) }),
    );
  });

  it("카드 완전 삭제는 막힌다 (지우기는 휴지통 표시로만. PRD: 지우면 휴지통으로)", async () => {
    await assertFails(deleteDoc(cardRef(rules.as(TEACHER2), CARD_ID)));
    await assertFails(deleteDoc(cardRef(rules.as(TEACHER2), TRASHED_CARD_ID)));
  });
});

describe("카드 문서 검증", () => {
  it.each(Object.keys(newCard(TEACHER)))("만들 때 %s 칸이 빠지면 막힌다", async (field) => {
    await assertFails(setDoc(cardRef(rules.as(TEACHER), "card-new"), withoutField(newCard(TEACHER), field)));
  });

  it.each([
    { field: "stage", value: 1 },
    { field: "stage", value: null },
    { field: "title", value: 42 },
    { field: "title", value: "" },
    { field: "title", value: null },
    { field: "order", value: "1024" },
    { field: "order", value: null },
    { field: "assigneeEmail", value: 5 },
    { field: "assigneeEmail", value: "이메일 아님" },
    { field: "assigneeEmail", value: "Teacher@Example.com" },
    { field: "assigneeEmail", value: [TEACHER] },
    { field: "dueDate", value: 20261020 },
    { field: "dueDate", value: "10/20/2026" },
    { field: "dueDate", value: "2026-10-20T00:00:00Z" },
    { field: "dueDate", value: "2026-13-40" },
    { field: "dueDate", value: "2026-00-10" },
    { field: "dueDate", value: "2026-02-30" },
    { field: "dueDate", value: "2026-11-31" },
    { field: "memo", value: null },
    { field: "memo", value: 3 },
    { field: "done", value: "false" },
    { field: "done", value: 0 },
    { field: "deletedAt", value: "2026-10-11" },
    { field: "deletedBy", value: 7 },
  ])("만들 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(setDoc(cardRef(rules.as(TEACHER), "card-new"), newCard(TEACHER, { [field]: value })));
  });

  it.each([
    { field: "title", value: 42 },
    { field: "title", value: "" },
    { field: "order", value: "first" },
    { field: "assigneeEmail", value: "이메일 아님" },
    { field: "dueDate", value: "내일" },
    { field: "memo", value: null },
    { field: "done", value: "true" },
  ])("고칠 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(updateDoc(cardRef(rules.as(TEACHER2), CARD_ID), { [field]: value, ...touch(TEACHER2) }));
  });

  it.each([
    { field: "title", max: LIMIT.cardTitle },
    { field: "memo", max: LIMIT.cardMemo },
  ])("$field 칸이 $max 글자를 넘으면 만들기·고치기 모두 막힌다", async ({ field, max }) => {
    const tooLong = koreanText(max + 1);
    await assertFails(setDoc(cardRef(rules.as(TEACHER), "card-new"), newCard(TEACHER, { [field]: tooLong })));
    await assertFails(updateDoc(cardRef(rules.as(TEACHER2), CARD_ID), { [field]: tooLong, ...touch(TEACHER2) }));
  });

  it.each([{ stage: "unknown" }, { stage: "Request" }, { stage: "" }, { stage: "done" }, { stage: "trash" }])(
    "단계 값 '$stage'는 만들기·옮기기 모두 막힌다",
    async ({ stage }) => {
      await assertFails(setDoc(cardRef(rules.as(TEACHER), "card-new"), newCard(TEACHER, { stage })));
      await assertFails(
        updateDoc(cardRef(rules.as(TEACHER2), CARD_ID), { stage, order: 1, ...touch(TEACHER2) }),
      );
    },
  );

  it("모르는 칸을 넣으면 만들기·고치기 모두 막힌다", async () => {
    await assertFails(setDoc(cardRef(rules.as(TEACHER), "card-new"), newCard(TEACHER, { priority: "high" })));
    await assertFails(updateDoc(cardRef(rules.as(TEACHER2), CARD_ID), { priority: "high", ...touch(TEACHER2) }));
  });

  it("처음부터 휴지통 상태인 카드는 만들 수 없다", async () => {
    await assertFails(
      setDoc(
        cardRef(rules.as(TEACHER), "card-new"),
        newCard(TEACHER, { deletedAt: serverTimestamp(), deletedBy: TEACHER }),
      ),
    );
  });

  it("휴지통 표시는 지금 시각·본인 이메일이어야 한다", async () => {
    const db = rules.as(TEACHER2);
    await assertFails(
      updateDoc(cardRef(db, CARD_ID), { deletedAt: serverTimestamp(), deletedBy: TEACHER, ...touch(TEACHER2) }),
    );
    await assertFails(
      updateDoc(cardRef(db, CARD_ID), { deletedAt: Timestamp.fromMillis(0), deletedBy: TEACHER2, ...touch(TEACHER2) }),
    );
    await assertFails(
      updateDoc(cardRef(db, CARD_ID), { deletedAt: serverTimestamp(), deletedBy: null, ...touch(TEACHER2) }),
    );
  });
});
