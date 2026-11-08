// 요구사항: 강사료 입금관리, 고객사 연락처
// - 강사료: 금액은 강사 본인과 관리자만 읽고 쓴다. 강사는 자기 강사료만 만든다.
//   과정이 실제로 있어야 하고, 과정·강사는 만든 뒤 바꿀 수 없다. 금액은 1원~10억 원 정수
// - 고객사: 팀원 모두가 보고 고친다. 지우기는 관리자만
// - 담당자: 팀원 모두가 보고 고치고 바로 지운다. 있는 고객사에만 붙고, 고객사는 바꿀 수 없다
// - 메일 보낸 기록(mailLog)은 브라우저에서 읽지도 쓰지도 못한다

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { ADMIN, BOOTSTRAP_EMAIL, COURSE_ID, koreanText, STRANGER, TEACHER, TEACHER2 } from "./support/constants";
import { createStamp, touch, withoutField, type Fields } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function feeRef(db: Firestore, id: string) {
  return doc(db, "fees", id);
}

/** createFee가 보내는 강사료 문서 */
function newFee(actor: string, overrides: Fields = {}): Fields {
  return {
    courseId: COURSE_ID,
    instructorEmail: actor,
    label: "1회차",
    amount: 1_200_000,
    dueDate: "2026-11-30",
    paidDate: null,
    memo: "",
    ...createStamp(actor),
    ...overrides,
  };
}

/** createClient가 보내는 고객사 문서 */
function newClient(actor: string, overrides: Fields = {}): Fields {
  return { name: "삼성전자", memo: "", ...createStamp(actor), ...overrides };
}

/** createContact가 보내는 담당자 문서 */
function newContact(actor: string, clientId: string, overrides: Fields = {}): Fields {
  return {
    clientId,
    name: "김담당",
    role: "인재개발팀 과장",
    phone: "010-1234-5678",
    email: "kim@samsung.com",
    memo: "",
    ...createStamp(actor),
    ...overrides,
  };
}

async function seedFee(id: string, owner: string): Promise<void> {
  await rules.privileged((db) => setDoc(feeRef(db, id), newFee(owner)));
}

describe("강사료", () => {
  it("강사는 자기 강사료를 만들고 읽고 고치고 지운다", async () => {
    const db = rules.as(TEACHER);
    const target = feeRef(db, "fee-own");
    await assertSucceeds(setDoc(target, newFee(TEACHER)));
    await assertSucceeds(getDoc(target));
    await assertSucceeds(updateDoc(target, { paidDate: "2026-12-01", amount: 1_000_000, ...touch(TEACHER) }));
    await assertSucceeds(deleteDoc(target));
  });

  it("다른 강사의 강사료는 읽지도 고치지도 지우지도 못한다", async () => {
    await seedFee("fee-teacher2", TEACHER2);
    const db = rules.as(TEACHER);
    const target = feeRef(db, "fee-teacher2");
    await assertFails(getDoc(target));
    await assertFails(updateDoc(target, { paidDate: "2026-12-01", ...touch(TEACHER) }));
    await assertFails(deleteDoc(target));
  });

  it("강사는 다른 강사 이름으로 강사료를 만들 수 없다", async () => {
    await assertFails(setDoc(feeRef(rules.as(TEACHER), "fee-x"), newFee(TEACHER, { instructorEmail: TEACHER2 })));
  });

  it("강사가 목록을 읽을 때는 '내 것' 조건이 있어야 한다", async () => {
    await seedFee("fee-a", TEACHER);
    await seedFee("fee-b", TEACHER2);
    const db = rules.as(TEACHER);
    await assertSucceeds(getDocs(query(collection(db, "fees"), where("instructorEmail", "==", TEACHER))));
    await assertFails(getDocs(collection(db, "fees")));
    await assertFails(getDocs(query(collection(db, "fees"), where("courseId", "==", COURSE_ID))));
  });

  it("관리자는 모든 강사료를 읽고, 팀원 누구의 강사료든 만들고 고친다", async () => {
    await seedFee("fee-t", TEACHER);
    const admin = rules.as(ADMIN);
    await assertSucceeds(getDocs(collection(admin, "fees")));
    await assertSucceeds(updateDoc(feeRef(admin, "fee-t"), { paidDate: "2026-12-01", ...touch(ADMIN) }));
    await assertSucceeds(setDoc(feeRef(admin, "fee-for-t2"), newFee(ADMIN, { instructorEmail: TEACHER2 })));
    // 첫 관리자도 관리자다
    await assertSucceeds(getDocs(collection(rules.as(BOOTSTRAP_EMAIL), "fees")));
  });

  it("관리자라도 팀원이 아닌 사람 앞으로는 만들 수 없다", async () => {
    await assertFails(setDoc(feeRef(rules.as(ADMIN), "fee-s"), newFee(ADMIN, { instructorEmail: STRANGER })));
  });

  it("팀원이 아니면 자기 이메일이어도 못 만든다", async () => {
    await assertFails(setDoc(feeRef(rules.as(STRANGER), "fee-s"), newFee(STRANGER)));
  });

  it.each<[string, Fields]>([
    ["없는 과정", { courseId: "no-such-course" }],
    ["금액 0원", { amount: 0 }],
    ["금액 음수", { amount: -1 }],
    ["금액 소수", { amount: 1000.5 }],
    ["금액 10억 초과", { amount: 1_000_000_001 }],
    ["금액이 글자", { amount: "1200000" }],
    ["예정일 없음", { dueDate: "" }],
    ["없는 날짜", { dueDate: "2026-02-30" }],
    ["입금일 형식 틀림", { paidDate: "12/01" }],
    ["항목 이름이 너무 김", { label: koreanText(101) }],
    ["메모가 너무 김", { memo: koreanText(1001) }],
    ["이메일 대문자", { instructorEmail: "Teacher@example.com" }],
    ["모르는 칸", { bankAccount: "123-456" }],
    ["만든 사람이 다름", { createdBy: TEACHER2 }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(feeRef(rules.as(TEACHER), "fee-bad"), newFee(TEACHER, overrides)));
  });

  it("10억 원 정확히는 된다", async () => {
    await assertSucceeds(setDoc(feeRef(rules.as(TEACHER), "fee-max"), newFee(TEACHER, { amount: 1_000_000_000 })));
  });

  it("빠진 칸이 있으면 막힌다", async () => {
    await assertFails(setDoc(feeRef(rules.as(TEACHER), "fee-missing"), withoutField(newFee(TEACHER), "paidDate")));
  });

  it("과정·강사는 바꿀 수 없다", async () => {
    await seedFee("fee-move", TEACHER);
    const admin = feeRef(rules.as(ADMIN), "fee-move");
    await assertFails(updateDoc(admin, { instructorEmail: TEACHER2, ...touch(ADMIN) }));
    await assertFails(updateDoc(admin, { courseId: "other-course", ...touch(ADMIN) }));
  });
});

describe("고객사", () => {
  it("팀원은 고객사를 만들고 읽고 고친다", async () => {
    const db = rules.as(TEACHER);
    const target = doc(db, "clients", "samsung");
    await assertSucceeds(setDoc(target, newClient(TEACHER)));
    await assertSucceeds(getDoc(doc(rules.as(TEACHER2), "clients", "samsung")));
    await assertSucceeds(updateDoc(target, { memo: "연 2회 교육", ...touch(TEACHER) }));
  });

  it("지우기는 관리자만", async () => {
    await rules.privileged((db) => setDoc(doc(db, "clients", "samsung"), newClient(TEACHER)));
    await assertFails(deleteDoc(doc(rules.as(TEACHER), "clients", "samsung")));
    await assertSucceeds(deleteDoc(doc(rules.as(ADMIN), "clients", "samsung")));
  });

  it("팀원이 아니면 읽지 못한다", async () => {
    await rules.privileged((db) => setDoc(doc(db, "clients", "samsung"), newClient(TEACHER)));
    await assertFails(getDoc(doc(rules.as(STRANGER), "clients", "samsung")));
  });

  it.each<[string, Fields]>([
    ["이름 없음", { name: "" }],
    ["이름이 너무 김", { name: koreanText(101) }],
    ["메모가 너무 김", { memo: koreanText(2001) }],
    ["모르는 칸", { phone: "02-000-0000" }],
  ])("막힌다: %s", async (_label, overrides) => {
    await assertFails(setDoc(doc(rules.as(TEACHER), "clients", "bad"), newClient(TEACHER, overrides)));
  });
});

describe("고객사 담당자", () => {
  async function seedClient(): Promise<void> {
    await rules.privileged((db) => setDoc(doc(db, "clients", "samsung"), newClient(TEACHER)));
  }

  it("팀원은 담당자를 만들고 고치고 지운다", async () => {
    await seedClient();
    const db = rules.as(TEACHER);
    const target = doc(db, "clientContacts", "kim");
    await assertSucceeds(setDoc(target, newContact(TEACHER, "samsung")));
    await assertSucceeds(updateDoc(target, { phone: "02-555-0000", email: "", ...touch(TEACHER) }));
    await assertSucceeds(getDocs(collection(rules.as(TEACHER2), "clientContacts")));
    await assertSucceeds(deleteDoc(target));
  });

  it("없는 고객사에는 붙일 수 없고, 고객사를 바꿀 수도 없다", async () => {
    await seedClient();
    const db = rules.as(TEACHER);
    await assertFails(setDoc(doc(db, "clientContacts", "x"), newContact(TEACHER, "no-such-client")));
    await assertSucceeds(setDoc(doc(db, "clientContacts", "kim"), newContact(TEACHER, "samsung")));
    await assertFails(updateDoc(doc(db, "clientContacts", "kim"), { clientId: "other", ...touch(TEACHER) }));
  });

  it("팀원이 아니면 읽지 못한다", async () => {
    await seedClient();
    await rules.privileged((db) => setDoc(doc(db, "clientContacts", "kim"), newContact(TEACHER, "samsung")));
    await assertFails(getDoc(doc(rules.as(STRANGER), "clientContacts", "kim")));
  });

  it.each<[string, Fields]>([
    ["이름 없음", { name: "" }],
    ["전화번호에 글자", { phone: "02-123-4567 내선 3" }],
    ["전화번호에 숫자가 없음", { phone: "---" }],
    ["전화번호가 너무 김", { phone: "0".repeat(31) }],
    ["이메일 형식 틀림", { email: "not-email" }],
    ["이메일 대문자", { email: "Kim@samsung.com" }],
    ["부서·직책이 너무 김", { role: koreanText(101) }],
    ["메모가 너무 김", { memo: koreanText(1001) }],
    ["모르는 칸", { birthday: "1990-01-01" }],
  ])("막힌다: %s", async (_label, overrides) => {
    await seedClient();
    await assertFails(
      setDoc(doc(rules.as(TEACHER), "clientContacts", "bad"), newContact(TEACHER, "samsung", overrides)),
    );
  });

  it("전화·이메일은 비워도 된다", async () => {
    await seedClient();
    await assertSucceeds(
      setDoc(doc(rules.as(TEACHER), "clientContacts", "blank"), newContact(TEACHER, "samsung", { phone: "", email: "" })),
    );
  });
});

describe("메일 보낸 기록", () => {
  it("관리자라도 브라우저에서는 읽지도 쓰지도 못한다", async () => {
    const admin = rules.as(ADMIN);
    await assertFails(getDoc(doc(admin, "mailLog", "2026-10-12")));
    await assertFails(setDoc(doc(admin, "mailLog", "2026-10-12"), { sentAt: 1 }));
  });
});
