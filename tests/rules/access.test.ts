// 요구사항: 누가 들어올 수 있는가
// - 로그인하지 않으면 어디도 못 읽고 못 쓴다
// - 이메일 인증(email_verified)이 안 된 계정은 팀원이어도 막힌다
// - 초대받지 않은 사람은 과정·하위 문서·팀원 목록을 못 읽고 못 쓰지만, 자기 members/{email} 경로는 get할 수 있다
// - 이메일은 대소문자를 가리지 않는다 (토큰의 대문자 이메일 = 소문자 문서 id)
// - 규칙에 적지 않은 경로는 전부 막힌다

import { describe, expect, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
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
} from "firebase/firestore";
import {
  ADMIN,
  BOOTSTRAP_EMAIL,
  CARD_ID,
  COURSE_ID,
  NEWCOMER,
  STRANGER,
  TEACHER,
  TEACHER2,
  uidOf,
} from "./support/constants";
import { invitation, newCourse, selfMemberDoc, touch } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";
import { ADMIN_WRITES, ALL_OPERATIONS, FORBIDDEN_WRITES, MEMBER_READS, MEMBER_WRITES } from "./support/operations";
import { collectionAt, docAt, type PathSegments } from "./support/paths";

const rules = setupRulesEnvironment();

describe("대조군: 초대된 팀원은 통과한다 (아래 '막힌다' 검사들이 문서 모양 탓이 아님을 보증)", () => {
  it.each([...MEMBER_READS, ...MEMBER_WRITES])("강사: $name", async ({ run }) => {
    await assertSucceeds(run(rules.as(TEACHER2), TEACHER2));
  });

  it.each(ADMIN_WRITES)("관리자: $name", async ({ run }) => {
    await assertSucceeds(run(rules.as(ADMIN), ADMIN));
  });

  it.each(ADMIN_WRITES)("첫 관리자(자기 문서가 아직 없음): $name", async ({ run }) => {
    await assertSucceeds(run(rules.as(BOOTSTRAP_EMAIL), BOOTSTRAP_EMAIL));
  });
});

describe("완전 삭제는 누구도 못 한다 (지우기는 휴지통 표시로만)", () => {
  it.each(FORBIDDEN_WRITES)("강사: $name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(TEACHER2), TEACHER2));
  });

  it.each(FORBIDDEN_WRITES)("관리자: $name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(ADMIN), ADMIN));
  });

  it.each(FORBIDDEN_WRITES)("첫 관리자: $name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(BOOTSTRAP_EMAIL), BOOTSTRAP_EMAIL));
  });
});

describe("로그인하지 않은 사람", () => {
  it.each(ALL_OPERATIONS)("$name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.anonymous(), "anonymous@example.com"));
  });

  it("어떤 팀원 문서 경로도 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(rules.anonymous(), "members", STRANGER)));
    await assertFails(getDoc(doc(rules.anonymous(), "members", BOOTSTRAP_EMAIL)));
  });
});

describe("이메일 인증이 안 된 계정", () => {
  it.each([...MEMBER_READS, ...MEMBER_WRITES])("초대된 강사라도 $name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(TEACHER, { verified: false }), TEACHER));
  });

  it.each(ADMIN_WRITES)("관리자라도 $name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(ADMIN, { verified: false }), ADMIN));
  });

  it("자기 팀원 문서도 읽을 수 없다", async () => {
    await assertFails(getDoc(doc(rules.as(TEACHER, { verified: false }), "members", TEACHER)));
    await assertFails(getDoc(doc(rules.as(STRANGER, { verified: false }), "members", STRANGER)));
  });

  it("첫 관리자 이메일이라도 미인증이면 관리자 문서를 만들거나 관리자 일을 할 수 없다", async () => {
    const db = rules.as(BOOTSTRAP_EMAIL, { verified: false });
    await assertFails(setDoc(doc(db, "members", BOOTSTRAP_EMAIL), selfMemberDoc(BOOTSTRAP_EMAIL)));
    await assertFails(setDoc(doc(db, "members", NEWCOMER), invitation(NEWCOMER, BOOTSTRAP_EMAIL)));
    await assertFails(deleteDoc(doc(db, "courses", COURSE_ID)));
    await assertFails(getDoc(doc(db, "courses", COURSE_ID)));
  });

  it("email_verified 값이 아예 없는 토큰은 막힌다", async () => {
    const db = rules.withToken(uidOf(TEACHER), { email: TEACHER });
    await assertFails(getDoc(doc(db, "courses", COURSE_ID)));
    await assertFails(getDoc(doc(db, "members", TEACHER)));
  });

  it("이메일이 없는 토큰(익명 로그인 등)은 막힌다", async () => {
    const db = rules.withToken("uid-without-email", { email_verified: true });
    await assertFails(getDoc(doc(db, "courses", COURSE_ID)));
    await assertFails(getDocs(collection(db, "members")));
  });
});

describe("초대받지 않은 사람 (로그인·이메일 인증은 됨)", () => {
  it.each(ALL_OPERATIONS)("$name — 막힌다", async ({ run }) => {
    await assertFails(run(rules.as(STRANGER), STRANGER));
  });

  it("자기 이메일의 팀원 문서 경로는 get할 수 있다 (초대 여부 확인용)", async () => {
    const snapshot = await assertSucceeds(getDoc(doc(rules.as(STRANGER), "members", STRANGER)));
    expect(snapshot.exists()).toBe(false);
  });

  it("대문자 섞인 토큰이어도 소문자 자기 경로를 get할 수 있다", async () => {
    const db = rules.as("Stranger@Example.COM");
    await assertSucceeds(getDoc(doc(db, "members", STRANGER)));
  });

  it("다른 사람(첫 관리자 포함)의 팀원 문서는 get할 수 없다", async () => {
    const db = rules.as(STRANGER);
    await assertFails(getDoc(doc(db, "members", ADMIN)));
    await assertFails(getDoc(doc(db, "members", BOOTSTRAP_EMAIL)));
  });

  it("자기 이메일 조건을 걸어도 팀원 목록 질의는 막힌다", async () => {
    const db = rules.as(STRANGER);
    await assertFails(getDocs(query(collection(db, "members"), where("email", "==", STRANGER))));
  });

  it("내보낸 사람은 바로 초대받지 않은 사람이 된다", async () => {
    await assertSucceeds(deleteDoc(doc(rules.as(ADMIN), "members", TEACHER)));
    const db = rules.as(TEACHER);
    await assertFails(getDoc(doc(db, "courses", COURSE_ID)));
    await assertFails(getDocs(collection(db, "members")));
    await assertSucceeds(getDoc(doc(db, "members", TEACHER)));
  });
});

describe("이메일 대소문자", () => {
  it.each([...MEMBER_READS, ...MEMBER_WRITES])(
    "대문자 섞인 강사 토큰(Teacher2@Example.COM)으로도 $name — 통과한다",
    async ({ run }) => {
      await assertSucceeds(run(rules.as("Teacher2@Example.COM"), TEACHER2));
    },
  );

  it.each(ADMIN_WRITES)("대문자 섞인 관리자 토큰(Admin@Example.COM)으로도 $name — 통과한다", async ({ run }) => {
    await assertSucceeds(run(rules.as("Admin@Example.COM"), ADMIN));
  });

  it("대문자 섞인 첫 관리자 토큰으로도 자기 관리자 문서를 만들고 관리자 일을 한다", async () => {
    const db = rules.as("Owner@Example.com");
    await assertSucceeds(setDoc(doc(db, "members", BOOTSTRAP_EMAIL), selfMemberDoc(BOOTSTRAP_EMAIL)));
    await assertSucceeds(
      updateDoc(doc(db, "courses", COURSE_ID), {
        deletedAt: serverTimestamp(),
        deletedBy: BOOTSTRAP_EMAIL,
        ...touch(BOOTSTRAP_EMAIL),
      }),
    );
  });

  it("작성자 도장은 소문자 이메일이어야 한다 (토큰 표기 그대로 대문자를 쓰면 막힌다)", async () => {
    const db = rules.as("Teacher2@Example.COM");
    await assertFails(setDoc(doc(db, "courses", "course-new"), newCourse("Teacher2@Example.COM")));
  });
});

describe("규칙에 없는 경로는 전부 막힌다", () => {
  const UNKNOWN_PATHS: { path: string; document: PathSegments; parent: PathSegments }[] = [
    { path: "settings/app", document: ["settings", "app"], parent: ["settings"] },
    { path: "admins/(첫 관리자)", document: ["admins", BOOTSTRAP_EMAIL], parent: ["admins"] },
    {
      path: "courses/{id}/secrets/x",
      document: ["courses", COURSE_ID, "secrets", "x"],
      parent: ["courses", COURSE_ID, "secrets"],
    },
    {
      path: "courses/{id}/cards/{id}/comments/x",
      document: ["courses", COURSE_ID, "cards", CARD_ID, "comments", "x"],
      parent: ["courses", COURSE_ID, "cards", CARD_ID, "comments"],
    },
    {
      path: "members/{email}/private/x",
      document: ["members", ADMIN, "private", "x"],
      parent: ["members", ADMIN, "private"],
    },
  ];
  const PEOPLE = [BOOTSTRAP_EMAIL, ADMIN, TEACHER];

  it.each(UNKNOWN_PATHS)("$path — 첫 관리자·관리자·강사 모두 읽기·쓰기·목록 불가", async ({ document, parent }) => {
    for (const email of PEOPLE) {
      const db = rules.as(email);
      await assertFails(getDoc(docAt(db, document)));
      await assertFails(setDoc(docAt(db, document), { value: 1 }));
      await assertFails(getDocs(collectionAt(db, parent)));
    }
  });

  it.each(UNKNOWN_PATHS)("$path — 로그인하지 않은 사람도 읽기·쓰기 불가", async ({ document, parent }) => {
    const db = rules.anonymous();
    await assertFails(getDoc(docAt(db, document)));
    await assertFails(setDoc(docAt(db, document), { value: 1 }));
    await assertFails(getDocs(collectionAt(db, parent)));
  });
});
