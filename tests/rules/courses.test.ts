// 요구사항: 과정(courses/{courseId})
// - 팀원은 올바른 과정을 만들고 읽고 고친다. 만든 사람이 아니어도 고친다 (가정 A3). 보관·복귀도 팀원 누구나
// - 검증: 잘못된 타입, 빠진 칸, 너무 긴 글, 잘못된 상태(status) 값, 모르는 칸은 막힌다
// - 휴지통 넣기·되살리기(deletedAt 설정·해제)는 관리자만. 휴지통에 있는 과정은 관리자만 고친다 (계약서)
// - 완전 삭제는 관리자만

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { DEFAULT_TEMPLATE, STAGE_IDS } from "@/lib/domain/stages";
import { rebalancedOrders } from "@/lib/domain/ordering";
import {
  ADMIN,
  BOOTSTRAP_EMAIL,
  COURSE_ID,
  koreanText,
  LIMIT,
  STRANGER,
  TEACHER,
  TEACHER2,
  TRASHED_COURSE_ID,
} from "./support/constants";
import {
  createStamp,
  newCard,
  newChecklistItem,
  newCourse,
  newSession,
  touch,
  withoutField,
} from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

function newCourseRef(email: string) {
  return doc(rules.as(email), "courses", "course-new");
}

function existingCourseRef(email: string, courseId: string = COURSE_ID) {
  return doc(rules.as(email), "courses", courseId);
}

describe("팀원의 과정 만들기·읽기·고치기", () => {
  it("과정 만들기 묶음 쓰기(createCourse 그대로: 과정 + 7단계 기본 카드 + 체크리스트 + 회차)가 통과한다", async () => {
    const db = rules.as(TEACHER2);
    const courseId = "course-from-template";
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", courseId), newCourse(TEACHER2, { instructorEmails: [TEACHER2, TEACHER] }));

    let cardCount = 0;
    for (const stageId of STAGE_IDS) {
      const templates = DEFAULT_TEMPLATE.filter((card) => card.stage === stageId);
      const cardOrders = rebalancedOrders(templates.length);
      templates.forEach((template, cardIndex) => {
        cardCount += 1;
        const cardId = `template-card-${cardCount}`;
        batch.set(doc(db, "courses", courseId, "cards", cardId), {
          stage: stageId,
          title: template.title,
          order: cardOrders[cardIndex],
          assigneeEmail: null,
          dueDate: null,
          memo: "",
          done: false,
          deletedAt: null,
          deletedBy: null,
          ...createStamp(TEACHER2),
        });
        const itemOrders = rebalancedOrders(template.checklist.length);
        template.checklist.forEach((text, itemIndex) => {
          batch.set(doc(db, "courses", courseId, "checklistItems", `${cardId}-item-${itemIndex}`), {
            cardId,
            text,
            done: false,
            order: itemOrders[itemIndex],
            ...createStamp(TEACHER2),
          });
        });
      });
    }
    batch.set(doc(db, "courses", courseId, "sessions", "template-session-1"), newSession(TEACHER2));
    batch.set(
      doc(db, "courses", courseId, "sessions", "template-session-2"),
      newSession(TEACHER2, { date: "2026-11-03", startTime: null, location: "", audience: "" }),
    );

    await assertSucceeds(batch.commit());
  });

  it("과정 복제 묶음 쓰기가 한 번에 쓸 수 있는 최대치(문서 500개)여도 통과한다", async () => {
    // duplicateCourse는 과정 1 + 카드 + 체크리스트를 한 묶음(최대 500개)으로 쓴다.
    // 문서마다 규칙이 팀원·부모 과정을 확인하는데, 묶음이 커도 규칙 한도에 걸리지 않는지 본다.
    const db = rules.as(TEACHER2);
    const courseId = "course-copy-max";
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", courseId), newCourse(TEACHER2));
    const cardCount = 150;
    const itemCount = 349;
    for (let index = 0; index < cardCount; index += 1) {
      batch.set(
        doc(db, "courses", courseId, "cards", `copy-card-${index}`),
        newCard(TEACHER2, { stage: STAGE_IDS[index % STAGE_IDS.length], order: (index + 1) * 1024 }),
      );
    }
    for (let index = 0; index < itemCount; index += 1) {
      batch.set(
        doc(db, "courses", courseId, "checklistItems", `copy-item-${index}`),
        newChecklistItem(TEACHER2, `copy-card-${index % cardCount}`, { order: (index + 1) * 1024 }),
      );
    }

    await assertSucceeds(batch.commit());
  });

  it("담당 강사가 비어 있어도, 길이 제한 끝값이어도 만들 수 있다", async () => {
    await assertSucceeds(
      setDoc(
        newCourseRef(TEACHER),
        newCourse(TEACHER, {
          title: koreanText(LIMIT.courseTitle),
          client: koreanText(LIMIT.courseClient),
          description: koreanText(LIMIT.courseDescription),
          instructorEmails: Array.from({ length: LIMIT.instructors }, (_, index) => `t${index}@example.com`),
        }),
      ),
    );
    await assertSucceeds(
      setDoc(doc(rules.as(TEACHER), "courses", "course-empty"), newCourse(TEACHER, { instructorEmails: [] })),
    );
  });

  it("고칠 때도 길이 제한 끝값(제목 100자·설명 2000자·담당 강사 20명)은 통과한다", async () => {
    await assertSucceeds(
      updateDoc(existingCourseRef(TEACHER2), {
        title: koreanText(LIMIT.courseTitle),
        description: koreanText(LIMIT.courseDescription),
        instructorEmails: Array.from(
          { length: LIMIT.instructors },
          (_, index) => `instructor.number-${index}@training-partner.example.co.kr`,
        ),
        ...touch(TEACHER2),
      }),
    );
  });

  it("만든 사람이 아닌 강사도 과정 정보를 고친다 (updateCourse와 같은 모양)", async () => {
    await assertSucceeds(
      updateDoc(existingCourseRef(TEACHER2), {
        title: "B사 리더십 과정",
        client: "B사",
        description: "2일 과정",
        instructorEmails: [TEACHER2],
        ...touch(TEACHER2),
      }),
    );
  });

  it("강사는 보관하고 다시 진행 중으로 돌린다", async () => {
    await assertSucceeds(updateDoc(existingCourseRef(TEACHER2), { status: "archived", ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(existingCourseRef(TEACHER2), { status: "active", ...touch(TEACHER2) }));
  });

  it("강사도 휴지통에 있는 과정을 읽을 수는 있다 (보관함·휴지통 화면용)", async () => {
    await assertSucceeds(getDoc(existingCourseRef(TEACHER, TRASHED_COURSE_ID)));
  });
});

describe("과정 문서 검증", () => {
  it.each(Object.keys(newCourse(TEACHER)))("만들 때 %s 칸이 빠지면 막힌다", async (field) => {
    await assertFails(setDoc(newCourseRef(TEACHER), withoutField(newCourse(TEACHER), field)));
  });

  it.each([
    { field: "title", value: 123 },
    { field: "title", value: null },
    { field: "title", value: "" },
    { field: "client", value: null },
    { field: "client", value: 7 },
    { field: "description", value: false },
    { field: "description", value: ["설명"] },
    { field: "instructorEmails", value: TEACHER },
    { field: "instructorEmails", value: null },
    { field: "instructorEmails", value: { first: TEACHER } },
    { field: "status", value: 1 },
    { field: "status", value: null },
    { field: "deletedAt", value: "2026-10-11" },
    { field: "deletedBy", value: 5 },
  ])("만들 때 $field 칸이 잘못된 값($value)이면 막힌다", async ({ field, value }) => {
    await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { [field]: value })));
  });

  it.each([
    { field: "title", max: LIMIT.courseTitle },
    { field: "client", max: LIMIT.courseClient },
    { field: "description", max: LIMIT.courseDescription },
  ])("$field 칸이 $max 글자를 넘으면 만들기·고치기 모두 막힌다", async ({ field, max }) => {
    const tooLong = koreanText(max + 1);
    await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { [field]: tooLong })));
    await assertFails(updateDoc(existingCourseRef(TEACHER), { [field]: tooLong, ...touch(TEACHER) }));
  });

  it("담당 강사가 20명을 넘으면 만들기·고치기 모두 막힌다", async () => {
    const tooMany = Array.from({ length: LIMIT.instructors + 1 }, (_, index) => `t${index}@example.com`);
    await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { instructorEmails: tooMany })));
    await assertFails(updateDoc(existingCourseRef(TEACHER), { instructorEmails: tooMany, ...touch(TEACHER) }));
  });

  // 데이터 모델: instructorEmails는 소문자 이메일 문자열의 목록 (최대 20개)
  const BAD_INSTRUCTOR_ELEMENTS = [
    { label: "숫자", element: 123 },
    { label: "객체", element: { email: TEACHER } },
    { label: "null", element: null },
    { label: "이메일이 아닌 글", element: "아무 글" },
    { label: "대문자 이메일", element: "Teacher@Example.com" },
    { label: "254자를 넘는 긴 글", element: `${"a".repeat(LIMIT.email)}@example.com` },
  ];

  it.each(BAD_INSTRUCTOR_ELEMENTS)("만들 때 담당 강사 목록의 원소가 [$label] — 막힌다", async ({ element }) => {
    await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { instructorEmails: [element] })));
  });

  it.each(BAD_INSTRUCTOR_ELEMENTS)("고칠 때 담당 강사 목록의 원소가 [$label] — 막힌다", async ({ element }) => {
    await assertFails(updateDoc(existingCourseRef(TEACHER), { instructorEmails: [element], ...touch(TEACHER) }));
  });

  it.each([{ status: "deleted" }, { status: "ACTIVE" }, { status: "" }, { status: "trashed" }])(
    "상태 값 '$status'는 만들기·고치기 모두 막힌다",
    async ({ status }) => {
      await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { status })));
      await assertFails(updateDoc(existingCourseRef(TEACHER), { status, ...touch(TEACHER) }));
    },
  );

  it("모르는 칸을 넣으면 만들기·고치기 모두 막힌다", async () => {
    await assertFails(setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { ownerOverride: true })));
    await assertFails(updateDoc(existingCourseRef(TEACHER), { ownerOverride: true, ...touch(TEACHER) }));
  });

  it("고칠 때 제목을 비우거나 타입을 바꾸면 막힌다", async () => {
    await assertFails(updateDoc(existingCourseRef(TEACHER), { title: "", ...touch(TEACHER) }));
    await assertFails(updateDoc(existingCourseRef(TEACHER), { client: 3, ...touch(TEACHER) }));
    await assertFails(updateDoc(existingCourseRef(TEACHER), { instructorEmails: TEACHER, ...touch(TEACHER) }));
  });
});

describe("과정 휴지통 (deletedAt)", () => {
  it("강사는 과정을 휴지통에 넣을 수 없다", async () => {
    await assertFails(
      updateDoc(existingCourseRef(TEACHER), { deletedAt: serverTimestamp(), deletedBy: TEACHER, ...touch(TEACHER) }),
    );
  });

  it("강사는 휴지통 과정을 되살릴 수 없다", async () => {
    await assertFails(
      updateDoc(existingCourseRef(TEACHER, TRASHED_COURSE_ID), {
        deletedAt: null,
        deletedBy: null,
        ...touch(TEACHER),
      }),
    );
  });

  it("강사는 처음부터 휴지통 상태인 과정을 만들 수 없다", async () => {
    await assertFails(
      setDoc(newCourseRef(TEACHER), newCourse(TEACHER, { deletedAt: serverTimestamp(), deletedBy: TEACHER })),
    );
  });

  it("강사는 휴지통에 있는 과정을 고치거나 보관할 수 없다 (계약서)", async () => {
    const ref = existingCourseRef(TEACHER, TRASHED_COURSE_ID);
    await assertFails(updateDoc(ref, { title: "몰래 고침", ...touch(TEACHER) }));
    await assertFails(updateDoc(ref, { status: "archived", ...touch(TEACHER) }));
  });

  it("관리자는 휴지통에 넣고 되살린다 (trashCourse·restoreCourse와 같은 모양)", async () => {
    const ref = existingCourseRef(ADMIN);
    await assertSucceeds(updateDoc(ref, { deletedAt: serverTimestamp(), deletedBy: ADMIN, ...touch(ADMIN) }));
    await assertSucceeds(updateDoc(ref, { deletedAt: null, deletedBy: null, ...touch(ADMIN) }));
  });

  it("관리자는 보관된 과정도 휴지통에 넣는다", async () => {
    await assertSucceeds(updateDoc(existingCourseRef(TEACHER), { status: "archived", ...touch(TEACHER) }));
    await assertSucceeds(
      updateDoc(existingCourseRef(ADMIN), { deletedAt: serverTimestamp(), deletedBy: ADMIN, ...touch(ADMIN) }),
    );
  });

  it("관리자라도 휴지통 표시는 지금 시각·본인 이메일이어야 한다", async () => {
    const ref = existingCourseRef(ADMIN);
    await assertFails(updateDoc(ref, { deletedAt: serverTimestamp(), deletedBy: TEACHER, ...touch(ADMIN) }));
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.fromMillis(0), deletedBy: ADMIN, ...touch(ADMIN) }));
    await assertFails(updateDoc(ref, { deletedAt: serverTimestamp(), deletedBy: null, ...touch(ADMIN) }));
    await assertFails(updateDoc(ref, { deletedAt: null, deletedBy: ADMIN, ...touch(ADMIN) }));
    await assertFails(updateDoc(ref, { deletedAt: "지금", deletedBy: ADMIN, ...touch(ADMIN) }));
  });

  it("계약서: 휴지통에 있는 과정도 관리자는 고칠 수 있다", async () => {
    await assertSucceeds(
      updateDoc(existingCourseRef(ADMIN, TRASHED_COURSE_ID), { title: "관리자가 고친 이름", ...touch(ADMIN) }),
    );
  });
});

describe("과정 완전 삭제", () => {
  it("강사·초대받지 않은 사람은 완전 삭제할 수 없다", async () => {
    await assertFails(deleteDoc(existingCourseRef(TEACHER)));
    await assertFails(deleteDoc(existingCourseRef(TEACHER, TRASHED_COURSE_ID)));
    await assertFails(deleteDoc(existingCourseRef(STRANGER)));
  });

  it("관리자도 완전 삭제할 수 없다 (지우기는 휴지통 표시로만. 30일 뒤 정리는 서버 작업이 한다)", async () => {
    await assertFails(deleteDoc(existingCourseRef(ADMIN)));
    await assertFails(deleteDoc(existingCourseRef(ADMIN, TRASHED_COURSE_ID)));
  });

  it("첫 관리자도 완전 삭제할 수 없다", async () => {
    await assertFails(deleteDoc(existingCourseRef(BOOTSTRAP_EMAIL)));
  });
});
