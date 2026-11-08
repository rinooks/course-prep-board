// 요구사항: 회차(courses/{id}/sessions/{sessionId}) — 과정을 실제로 진행하는 날짜·장소·대상 (가정 A1)
// - 팀원은 회차를 여러 개 등록하고 고치고 지운다
// - 검증: 잘못된 타입·형식, 빠진 칸, 너무 긴 글, 모르는 칸은 막힌다
// 작성자·시각 도장은 stamps.test.ts에서 검사한다.

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { COURSE_ID, koreanText, LIMIT, SESSION_ID, TEACHER, TEACHER2 } from "./support/constants";
import { newSession, touch, withoutField } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function sessionRef(db: Firestore, sessionId: string) {
  return doc(db, "courses", COURSE_ID, "sessions", sessionId);
}

describe("팀원의 회차 쓰기", () => {
  it("회차를 여러 개 등록한다 (시작 시간·장소·대상은 비워도 된다)", async () => {
    const db = rules.as(TEACHER2);
    await assertSucceeds(setDoc(sessionRef(db, "session-a"), newSession(TEACHER2)));
    await assertSucceeds(
      setDoc(
        sessionRef(db, "session-b"),
        newSession(TEACHER2, { date: "2026-11-02", startTime: null, location: "", audience: "", note: "" }),
      ),
    );
    await assertSucceeds(
      setDoc(sessionRef(db, "session-c"), newSession(TEACHER2, { date: "2026-12-31", startTime: "23:59" })),
    );
  });

  it.each(["2028-02-29", "2000-02-29", "2026-02-28", "2026-04-30", "2026-01-31", "2026-12-31"])(
    "달력에 있는 날짜 %s는 통과한다 (윤년 2월 29일 포함)",
    async (date) => {
      await assertSucceeds(setDoc(sessionRef(rules.as(TEACHER2), `session-${date}`), newSession(TEACHER2, { date })));
    },
  );

  it("길이 제한 끝값(장소·대상 200자, 메모 1000자)은 통과한다", async () => {
    await assertSucceeds(
      setDoc(
        sessionRef(rules.as(TEACHER2), "session-long"),
        newSession(TEACHER2, {
          location: koreanText(LIMIT.sessionLocation),
          audience: koreanText(LIMIT.sessionAudience),
          note: koreanText(LIMIT.sessionNote),
        }),
      ),
    );
  });

  it("만든 사람이 아닌 강사도 회차를 고친다 (updateSession과 같은 모양)", async () => {
    await assertSucceeds(
      updateDoc(sessionRef(rules.as(TEACHER2), SESSION_ID), {
        date: "2026-10-21",
        startTime: "13:00",
        location: "온라인",
        audience: "팀장 20명",
        note: "줌 링크 공유",
        ...touch(TEACHER2),
      }),
    );
    await assertSucceeds(
      updateDoc(sessionRef(rules.as(TEACHER2), SESSION_ID), { startTime: null, ...touch(TEACHER2) }),
    );
  });

  it("회차를 지운다", async () => {
    await assertSucceeds(deleteDoc(sessionRef(rules.as(TEACHER2), SESSION_ID)));
  });
});

describe("회차 문서 검증", () => {
  it.each(Object.keys(newSession(TEACHER)))("만들 때 %s 칸이 빠지면 막힌다", async (field) => {
    await assertFails(setDoc(sessionRef(rules.as(TEACHER), "session-new"), withoutField(newSession(TEACHER), field)));
  });

  it.each([
    { field: "date", value: 20261020 },
    { field: "date", value: null },
    { field: "date", value: "" },
    { field: "date", value: "2026-19-39" },
    { field: "date", value: "2026-10-00" },
    { field: "date", value: "2026-02-30" },
    { field: "date", value: "2026-02-29" },
    { field: "date", value: "2026-04-31" },
    { field: "date", value: "2100-02-29" },
    { field: "date", value: "2026/10/20" },
    { field: "date", value: "20-10-2026" },
    { field: "startTime", value: 930 },
    { field: "startTime", value: "9:30" },
    { field: "startTime", value: "24:00" },
    { field: "startTime", value: "09:60" },
    { field: "startTime", value: "오전 9시" },
    { field: "location", value: null },
    { field: "location", value: 3 },
    { field: "audience", value: 30 },
    { field: "note", value: false },
  ])("만들 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(
      setDoc(sessionRef(rules.as(TEACHER), "session-new"), newSession(TEACHER, { [field]: value })),
    );
  });

  it.each([
    { field: "date", value: "내일" },
    { field: "startTime", value: "25:00" },
    { field: "location", value: null },
    { field: "note", value: 1 },
  ])("고칠 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(
      updateDoc(sessionRef(rules.as(TEACHER2), SESSION_ID), { [field]: value, ...touch(TEACHER2) }),
    );
  });

  it.each([
    { field: "location", max: LIMIT.sessionLocation },
    { field: "audience", max: LIMIT.sessionAudience },
    { field: "note", max: LIMIT.sessionNote },
  ])("$field 칸이 $max 글자를 넘으면 만들기·고치기 모두 막힌다", async ({ field, max }) => {
    const tooLong = koreanText(max + 1);
    await assertFails(
      setDoc(sessionRef(rules.as(TEACHER), "session-new"), newSession(TEACHER, { [field]: tooLong })),
    );
    await assertFails(
      updateDoc(sessionRef(rules.as(TEACHER2), SESSION_ID), { [field]: tooLong, ...touch(TEACHER2) }),
    );
  });

  it("모르는 칸을 넣으면 만들기·고치기 모두 막힌다", async () => {
    await assertFails(
      setDoc(sessionRef(rules.as(TEACHER), "session-new"), newSession(TEACHER, { fee: 1000000 })),
    );
    await assertFails(updateDoc(sessionRef(rules.as(TEACHER2), SESSION_ID), { fee: 1000000, ...touch(TEACHER2) }));
  });
});
