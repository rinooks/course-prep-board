// 요구사항: 팀원(members/{소문자 이메일}) 문서
// - 첫 관리자(owner@example.com)만 자기 문서를 관리자로 만들 수 있다. 그 밖의 누구도 자기 문서를 스스로 만들 수 없다
// - 팀원은 자기 문서의 uid·displayName·photoURL·lastLoginAt만 고친다. 역할·이메일은 못 바꾸고, 남의 문서는 못 고치고,
//   팀원 문서를 만들거나 지울 수 없다
// - 관리자는 초대(만들기)·역할 변경·내보내기(지우기)를 한다
// - 계약서: 관리자도 자기 역할 변경·자기 내보내기는 못 하고, 첫 관리자는 강등·내보내기할 수 없다
// - 검증: 잘못된 역할 값, 빠진 칸, 너무 긴 글, 남의 이름으로 초대 등은 막힌다

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ADMIN,
  BOOTSTRAP_EMAIL,
  COURSE_ID,
  LIMIT,
  NEWCOMER,
  STRANGER,
  TEACHER,
  TEACHER2,
  uidOf,
} from "./support/constants";
import { invitation, profileUpdate, selfMemberDoc, withoutField } from "./support/documents";
import { seedBootstrapMember, setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

describe("첫 관리자 문서 만들기", () => {
  it("첫 관리자는 첫 로그인 때 자기 문서를 관리자로 만든다 (createBootstrapAdmin과 같은 모양)", async () => {
    const db = rules.as(BOOTSTRAP_EMAIL);
    await assertSucceeds(getDoc(doc(db, "members", BOOTSTRAP_EMAIL)));
    await assertSucceeds(setDoc(doc(db, "members", BOOTSTRAP_EMAIL), selfMemberDoc(BOOTSTRAP_EMAIL)));
  });

  it("초대받지 않은 사람은 자기 문서를 관리자로 만들 수 없다", async () => {
    await assertFails(setDoc(doc(rules.as(STRANGER), "members", STRANGER), selfMemberDoc(STRANGER)));
  });

  it("초대받지 않은 사람은 자기 문서를 강사로도 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(rules.as(STRANGER), "members", STRANGER), selfMemberDoc(STRANGER, { role: "instructor" })),
    );
    await assertFails(
      setDoc(doc(rules.as(STRANGER), "members", STRANGER), invitation(STRANGER, STRANGER)),
    );
  });

  it("다른 사람이 첫 관리자 경로에 관리자 문서를 대신 만들 수 없다", async () => {
    await assertFails(
      setDoc(doc(rules.as(STRANGER), "members", BOOTSTRAP_EMAIL), selfMemberDoc(BOOTSTRAP_EMAIL)),
    );
    await assertFails(
      setDoc(doc(rules.as(TEACHER), "members", BOOTSTRAP_EMAIL), selfMemberDoc(BOOTSTRAP_EMAIL)),
    );
  });

  it.each([
    { look: "owner@example.com.evil.com" },
    { look: "owner+admin@example.com" },
    { look: "xowner@example.com" },
  ])("첫 관리자와 비슷한 이메일($look)은 관리자 문서를 만들 수 없다", async ({ look }) => {
    await assertFails(setDoc(doc(rules.as(look), "members", look), selfMemberDoc(look)));
  });

  it("이미 초대된 강사도 자기 문서를 관리자로 다시 만들거나 덮어쓸 수 없다", async () => {
    const db = rules.as(TEACHER);
    await assertFails(setDoc(doc(db, "members", TEACHER), selfMemberDoc(TEACHER)));
  });

  it("강사는 다른 사람 문서를 관리자로 만들 수 없다 (자기 편 관리자 심기)", async () => {
    await assertFails(
      setDoc(doc(rules.as(TEACHER), "members", NEWCOMER), invitation(NEWCOMER, TEACHER, { role: "admin" })),
    );
  });

  it("첫 관리자도 남의 uid를 넣어 자기 문서를 만들 수 없다", async () => {
    await assertFails(
      setDoc(
        doc(rules.as(BOOTSTRAP_EMAIL), "members", BOOTSTRAP_EMAIL),
        selfMemberDoc(BOOTSTRAP_EMAIL, { uid: uidOf(STRANGER) }),
      ),
    );
  });
});

describe("본인 문서 고치기", () => {
  it("로그인 때 프로필(uid·이름·사진·마지막 로그인)을 갱신한다 (linkMemberProfile과 같은 모양)", async () => {
    await assertSucceeds(updateDoc(doc(rules.as(TEACHER), "members", TEACHER), profileUpdate(TEACHER)));
  });

  it("관리자도 자기 프로필은 갱신한다", async () => {
    await assertSucceeds(updateDoc(doc(rules.as(ADMIN), "members", ADMIN), profileUpdate(ADMIN)));
  });

  it("첫 관리자는 다음 로그인부터 자기 프로필을 갱신한다", async () => {
    await seedBootstrapMember(rules);
    const db = rules.as(BOOTSTRAP_EMAIL);
    await assertSucceeds(updateDoc(doc(db, "members", BOOTSTRAP_EMAIL), profileUpdate(BOOTSTRAP_EMAIL)));
  });

  it("대문자 섞인 토큰으로도 소문자 자기 문서의 프로필을 갱신한다", async () => {
    const db = rules.as("Teacher@Example.COM");
    await assertSucceeds(updateDoc(doc(db, "members", TEACHER), profileUpdate(TEACHER)));
  });

  it.each([
    { field: "role", value: "admin" },
    { field: "email", value: "other@example.com" },
    { field: "invitedBy", value: TEACHER },
    { field: "invitedAt", value: Timestamp.now() },
    { field: "isAdmin", value: true },
    { field: "permissions", value: ["delete-course"] },
  ])("자기 $field 칸은 바꾸거나 새로 넣을 수 없다 (프로필 갱신과 함께 보내도)", async ({ field, value }) => {
    const db = rules.as(TEACHER);
    await assertFails(updateDoc(doc(db, "members", TEACHER), { [field]: value }));
    await assertFails(updateDoc(doc(db, "members", TEACHER), { ...profileUpdate(TEACHER), [field]: value }));
  });

  it("문서 전체를 덮어써 역할을 바꿀 수 없다", async () => {
    const db = rules.as(TEACHER);
    await assertFails(
      setDoc(doc(db, "members", TEACHER), { ...invitation(TEACHER, ADMIN), ...profileUpdate(TEACHER), role: "admin" }),
    );
  });

  it("프로필에 남의 uid를 적을 수 없다", async () => {
    await assertFails(
      updateDoc(doc(rules.as(TEACHER), "members", TEACHER), profileUpdate(TEACHER, { uid: uidOf(TEACHER2) })),
    );
  });

  it("다른 팀원의 문서는 프로필이라도 고칠 수 없다", async () => {
    await assertFails(
      updateDoc(doc(rules.as(TEACHER), "members", TEACHER2), profileUpdate(TEACHER2, { uid: uidOf(TEACHER) })),
    );
    await assertFails(updateDoc(doc(rules.as(TEACHER), "members", TEACHER2), profileUpdate(TEACHER2)));
  });

  it("강사는 팀원 문서를 지울 수 없다 (자기 자신 포함)", async () => {
    await assertFails(deleteDoc(doc(rules.as(TEACHER), "members", TEACHER)));
    await assertFails(deleteDoc(doc(rules.as(TEACHER), "members", TEACHER2)));
    await assertFails(deleteDoc(doc(rules.as(TEACHER), "members", ADMIN)));
  });

  it("강사는 팀원을 초대할 수 없다", async () => {
    await assertFails(setDoc(doc(rules.as(TEACHER), "members", NEWCOMER), invitation(NEWCOMER, TEACHER)));
  });

  it("강사는 다른 사람의 역할을 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(rules.as(TEACHER), "members", TEACHER2), { role: "admin" }));
    await assertFails(updateDoc(doc(rules.as(TEACHER), "members", ADMIN), { role: "instructor" }));
  });

  it.each([
    { field: "displayName", value: "가".repeat(LIMIT.displayName + 1) },
    { field: "photoURL", value: `https://example.com/${"a".repeat(LIMIT.photoURL)}` },
    { field: "displayName", value: 42 },
    { field: "photoURL", value: null },
    { field: "lastLoginAt", value: Timestamp.fromMillis(0) },
  ])("프로필 갱신 검증: $field 값이 잘못되면 막힌다", async ({ field, value }) => {
    await assertFails(
      updateDoc(doc(rules.as(TEACHER), "members", TEACHER), profileUpdate(TEACHER, { [field]: value })),
    );
  });

  it("프로필 길이 제한 끝값(이름 100자·사진 주소 2048자)은 통과한다", async () => {
    await assertSucceeds(
      updateDoc(
        doc(rules.as(TEACHER), "members", TEACHER),
        profileUpdate(TEACHER, {
          displayName: "가".repeat(LIMIT.displayName),
          photoURL: `https://e.com/${"a".repeat(LIMIT.photoURL - "https://e.com/".length)}`,
        }),
      ),
    );
  });
});

describe("관리자 팀 관리", () => {
  it("관리자는 팀원 목록을 읽는다", async () => {
    await assertSucceeds(getDocs(collection(rules.as(ADMIN), "members")));
  });

  it("관리자는 강사를 초대한다 (inviteMember처럼 먼저 get으로 중복 확인)", async () => {
    const db = rules.as(ADMIN);
    await assertSucceeds(getDoc(doc(db, "members", NEWCOMER)));
    await assertSucceeds(setDoc(doc(db, "members", NEWCOMER), invitation(NEWCOMER, ADMIN)));
  });

  it("관리자는 처음부터 관리자 역할로 초대할 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), invitation(NEWCOMER, ADMIN, { role: "admin" })),
    );
  });

  it("초대받은 사람은 바로 팀원이 되어 과정을 읽는다", async () => {
    await assertSucceeds(setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), invitation(NEWCOMER, ADMIN)));
    await assertSucceeds(getDoc(doc(rules.as(NEWCOMER), "courses", COURSE_ID)));
  });

  it("관리자는 강사를 관리자로 지정하고, 다른 관리자를 강사로 바꾼다", async () => {
    const db = rules.as(ADMIN);
    await assertSucceeds(updateDoc(doc(db, "members", TEACHER), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(db, "members", TEACHER), { role: "instructor" }));
  });

  it("관리자로 지정된 강사는 바로 관리자 일을 한다", async () => {
    await assertSucceeds(updateDoc(doc(rules.as(ADMIN), "members", TEACHER), { role: "admin" }));
    await assertSucceeds(
      setDoc(doc(rules.as(TEACHER), "members", NEWCOMER), invitation(NEWCOMER, TEACHER)),
    );
  });

  it("강사로 바뀐 관리자는 바로 관리자 권한을 잃는다", async () => {
    await assertSucceeds(updateDoc(doc(rules.as(BOOTSTRAP_EMAIL), "members", ADMIN), { role: "instructor" }));
    await assertFails(setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), invitation(NEWCOMER, ADMIN)));
    await assertFails(deleteDoc(doc(rules.as(ADMIN), "courses", COURSE_ID)));
  });

  it("관리자는 팀원을 내보낸다", async () => {
    await assertSucceeds(deleteDoc(doc(rules.as(ADMIN), "members", TEACHER)));
  });

  it("첫 관리자도 문서 없이 초대·역할 변경·내보내기를 한다", async () => {
    const db = rules.as(BOOTSTRAP_EMAIL);
    await assertSucceeds(setDoc(doc(db, "members", NEWCOMER), invitation(NEWCOMER, BOOTSTRAP_EMAIL)));
    await assertSucceeds(updateDoc(doc(db, "members", TEACHER), { role: "admin" }));
    await assertSucceeds(deleteDoc(doc(db, "members", TEACHER2)));
  });

  it("계약서: 관리자도 자기 역할을 바꾸거나 자기를 내보낼 수 없다", async () => {
    const db = rules.as(ADMIN);
    await assertFails(updateDoc(doc(db, "members", ADMIN), { role: "instructor" }));
    await assertFails(deleteDoc(doc(db, "members", ADMIN)));
  });

  it("계약서: 첫 관리자는 강등하거나 내보낼 수 없다", async () => {
    await seedBootstrapMember(rules);
    const db = rules.as(ADMIN);
    await assertFails(updateDoc(doc(db, "members", BOOTSTRAP_EMAIL), { role: "instructor" }));
    await assertFails(deleteDoc(doc(db, "members", BOOTSTRAP_EMAIL)));
  });

  it("관리자도 역할 말고 다른 칸(이메일·초대한 사람·uid)은 바꿀 수 없다", async () => {
    const db = rules.as(ADMIN);
    await assertFails(updateDoc(doc(db, "members", TEACHER), { email: "changed@example.com" }));
    await assertFails(updateDoc(doc(db, "members", TEACHER), { role: "admin", invitedBy: ADMIN }));
    await assertFails(updateDoc(doc(db, "members", TEACHER), { uid: uidOf(ADMIN) }));
  });
});

describe("팀원 문서 검증", () => {
  it.each([
    { role: "owner" },
    { role: "ADMIN" },
    { role: "" },
    { role: true },
    { role: 1 },
    { role: null },
  ])("초대할 때 잘못된 역할($role)은 막힌다", async ({ role }) => {
    await assertFails(setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), invitation(NEWCOMER, ADMIN, { role })));
  });

  it.each([{ role: "owner" }, { role: "Admin" }, { role: "" }, { role: 1 }, { role: null }])(
    "역할을 바꿀 때 잘못된 역할($role)은 막힌다",
    async ({ role }) => {
      await assertFails(updateDoc(doc(rules.as(ADMIN), "members", TEACHER), { role }));
    },
  );

  it.each(Object.keys(invitation(NEWCOMER, ADMIN)))("초대 문서에 %s 칸이 빠지면 막힌다", async (field) => {
    await assertFails(
      setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), withoutField(invitation(NEWCOMER, ADMIN), field)),
    );
  });

  it.each(Object.keys(selfMemberDoc(BOOTSTRAP_EMAIL)))(
    "첫 관리자 문서에 %s 칸이 빠지면 막힌다",
    async (field) => {
      await assertFails(
        setDoc(
          doc(rules.as(BOOTSTRAP_EMAIL), "members", BOOTSTRAP_EMAIL),
          withoutField(selfMemberDoc(BOOTSTRAP_EMAIL), field),
        ),
      );
    },
  );

  it("초대 문서에 모르는 칸을 넣으면 막힌다", async () => {
    await assertFails(
      setDoc(doc(rules.as(ADMIN), "members", NEWCOMER), invitation(NEWCOMER, ADMIN, { isOwner: true })),
    );
  });

  it("초대 경로는 소문자 이메일이어야 하고, 문서의 email과 같아야 한다", async () => {
    const db = rules.as(ADMIN);
    await assertFails(setDoc(doc(db, "members", "Newcomer@Example.com"), invitation("Newcomer@Example.com", ADMIN)));
    await assertFails(setDoc(doc(db, "members", NEWCOMER), invitation("other@example.com", ADMIN)));
    await assertFails(setDoc(doc(db, "members", "not-an-email"), invitation("not-an-email", ADMIN)));
  });

  it("너무 긴 이메일로는 초대할 수 없다", async () => {
    const longEmail = `${"a".repeat(LIMIT.email)}@example.com`;
    await assertFails(setDoc(doc(rules.as(ADMIN), "members", longEmail), invitation(longEmail, ADMIN)));
  });

  it("남의 이름으로 초대하거나, 초대 시각을 지어내거나, uid·이름·로그인 시각을 미리 채울 수 없다", async () => {
    const db = rules.as(ADMIN);
    const target = doc(db, "members", NEWCOMER);
    await assertFails(setDoc(target, invitation(NEWCOMER, TEACHER)));
    await assertFails(setDoc(target, invitation(NEWCOMER, ADMIN, { invitedAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(target, invitation(NEWCOMER, ADMIN, { uid: uidOf(NEWCOMER) })));
    await assertFails(setDoc(target, invitation(NEWCOMER, ADMIN, { displayName: "미리 채운 이름" })));
    await assertFails(setDoc(target, invitation(NEWCOMER, ADMIN, { lastLoginAt: Timestamp.now() })));
  });

  it("첫 관리자 문서는 관리자 역할·자기 email·자기 초대여야 한다", async () => {
    const db = rules.as(BOOTSTRAP_EMAIL);
    const target = doc(db, "members", BOOTSTRAP_EMAIL);
    await assertFails(setDoc(target, selfMemberDoc(BOOTSTRAP_EMAIL, { role: "owner" })));
    await assertFails(setDoc(target, selfMemberDoc(BOOTSTRAP_EMAIL, { email: "other@example.com" })));
    await assertFails(setDoc(target, selfMemberDoc(BOOTSTRAP_EMAIL, { invitedBy: ADMIN })));
    await assertFails(setDoc(target, selfMemberDoc(BOOTSTRAP_EMAIL, { displayName: 7 })));
  });
});
