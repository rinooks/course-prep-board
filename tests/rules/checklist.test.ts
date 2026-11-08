// 요구사항: 체크리스트 항목(courses/{id}/checklistItems/{itemId})
// - 팀원은 항목을 추가·체크·글 고치기·순서 바꾸기·삭제한다
// - 두 사람이 동시에 다른 항목을 체크해도 서로 덮어쓰지 않는다 (항목마다 문서가 따로 있다)
// - 검증: 잘못된 타입, 빠진 칸, 너무 긴 글, 모르는 칸은 막힌다. 계약서: 다른 카드로 옮길 수 없다
// 작성자·시각 도장은 stamps.test.ts에서 검사한다.

import { describe, expect, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch, type Firestore } from "firebase/firestore";
import {
  CARD_ID,
  COURSE_ID,
  ITEM_ID,
  koreanText,
  LIMIT,
  SECOND_CARD_ID,
  SECOND_ITEM_ID,
  TEACHER,
  TEACHER2,
} from "./support/constants";
import { newChecklistItem, touch, withoutField } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function itemRef(db: Firestore, itemId: string) {
  return doc(db, "courses", COURSE_ID, "checklistItems", itemId);
}

describe("팀원의 체크리스트 쓰기", () => {
  it("항목을 추가한다 (createChecklistItem과 같은 모양)", async () => {
    await assertSucceeds(setDoc(itemRef(rules.as(TEACHER2), "item-new"), newChecklistItem(TEACHER2, CARD_ID)));
  });

  it("글 길이 제한 끝값(300자)은 통과한다", async () => {
    await assertSucceeds(
      setDoc(
        itemRef(rules.as(TEACHER2), "item-long"),
        newChecklistItem(TEACHER2, CARD_ID, { text: koreanText(LIMIT.checklistText) }),
      ),
    );
  });

  it("만든 사람이 아닌 강사도 체크하고, 체크를 풀고, 글을 고친다", async () => {
    const db = rules.as(TEACHER2);
    await assertSucceeds(updateDoc(itemRef(db, ITEM_ID), { done: true, ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(itemRef(db, ITEM_ID), { done: false, ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(itemRef(db, ITEM_ID), { text: "교육 대상·인원 확인", ...touch(TEACHER2) }));
  });

  it("같은 카드 안에서 순서를 바꾼다 (reorderChecklistItem 묶음 쓰기)", async () => {
    const db = rules.as(TEACHER2);
    const batch = writeBatch(db);
    batch.update(itemRef(db, SECOND_ITEM_ID), { order: 1024, ...touch(TEACHER2) });
    batch.update(itemRef(db, ITEM_ID), { order: 2048, ...touch(TEACHER2) });
    await assertSucceeds(batch.commit());
  });

  it("항목을 지운다", async () => {
    await assertSucceeds(deleteDoc(itemRef(rules.as(TEACHER2), ITEM_ID)));
  });

  it("두 사람이 동시에 다른 항목을 체크해도 둘 다 남는다", async () => {
    const first = rules.as(TEACHER);
    const second = rules.as(TEACHER2);
    await Promise.all([
      assertSucceeds(updateDoc(itemRef(first, ITEM_ID), { done: true, ...touch(TEACHER) })),
      assertSucceeds(updateDoc(itemRef(second, SECOND_ITEM_ID), { done: true, ...touch(TEACHER2) })),
    ]);
    const one = await getDoc(itemRef(first, ITEM_ID));
    const two = await getDoc(itemRef(first, SECOND_ITEM_ID));
    expect(one.data()?.done).toBe(true);
    expect(two.data()?.done).toBe(true);
  });
});

describe("체크리스트 항목 검증", () => {
  it.each(Object.keys(newChecklistItem(TEACHER, CARD_ID)))("만들 때 %s 칸이 빠지면 막힌다", async (field) => {
    await assertFails(
      setDoc(itemRef(rules.as(TEACHER), "item-new"), withoutField(newChecklistItem(TEACHER, CARD_ID), field)),
    );
  });

  it.each([
    { field: "cardId", value: 1 },
    { field: "cardId", value: "" },
    { field: "cardId", value: null },
    { field: "text", value: 3 },
    { field: "text", value: "" },
    { field: "text", value: null },
    { field: "done", value: "false" },
    { field: "done", value: null },
    { field: "order", value: "1" },
    { field: "order", value: null },
  ])("만들 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(
      setDoc(itemRef(rules.as(TEACHER), "item-new"), newChecklistItem(TEACHER, CARD_ID, { [field]: value })),
    );
  });

  it.each([
    { field: "text", value: "" },
    { field: "text", value: 9 },
    { field: "done", value: "yes" },
    { field: "order", value: "last" },
  ])("고칠 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(updateDoc(itemRef(rules.as(TEACHER2), ITEM_ID), { [field]: value, ...touch(TEACHER2) }));
  });

  it("글이 300자를 넘으면 만들기·고치기 모두 막힌다", async () => {
    const tooLong = koreanText(LIMIT.checklistText + 1);
    await assertFails(
      setDoc(itemRef(rules.as(TEACHER), "item-new"), newChecklistItem(TEACHER, CARD_ID, { text: tooLong })),
    );
    await assertFails(updateDoc(itemRef(rules.as(TEACHER2), ITEM_ID), { text: tooLong, ...touch(TEACHER2) }));
  });

  it("모르는 칸을 넣으면 만들기·고치기 모두 막힌다", async () => {
    await assertFails(
      setDoc(itemRef(rules.as(TEACHER), "item-new"), newChecklistItem(TEACHER, CARD_ID, { checkedBy: TEACHER })),
    );
    await assertFails(updateDoc(itemRef(rules.as(TEACHER2), ITEM_ID), { checkedBy: TEACHER2, ...touch(TEACHER2) }));
  });

  it("계약서: 항목을 다른 카드로 옮길 수 없다", async () => {
    await assertFails(
      updateDoc(itemRef(rules.as(TEACHER2), ITEM_ID), { cardId: SECOND_CARD_ID, ...touch(TEACHER2) }),
    );
  });
});
