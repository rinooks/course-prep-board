// Firestore 보안 규칙 테스트. 실제 배포에 쓰는 firestore.rules를 에뮬레이터에 올려 검사한다.
// 실행: npm run test:rules (Java와 firebase CLI 필요)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { DEFAULT_TEMPLATE } from "@/lib/domain/stages";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/domain/roles";

const ADMIN = "admin@example.com";
const TEACHER = "teacher@example.com";
const TEACHER2 = "teacher2@example.com";
const STRANGER = "stranger@example.com";
const COURSE = "course1";

let env: RulesTestEnvironment;

function dbAs(email: string, options: { verified?: boolean } = {}): Firestore {
  const uid = `uid-${email}`;
  return env
    .authenticatedContext(uid, { email, email_verified: options.verified ?? true })
    .firestore() as unknown as Firestore;
}

function anonymousDb(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

function stamps(email: string) {
  return {
    createdBy: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: email,
  };
}

function touch(email: string) {
  return { updatedAt: serverTimestamp(), updatedBy: email };
}

function courseData(email: string, overrides: Record<string, unknown> = {}) {
  return {
    title: "A사 신입사원 AI 과정",
    client: "A사",
    description: "",
    instructorEmails: [email],
    status: "active",
    deletedAt: null,
    deletedBy: null,
    ...stamps(email),
    ...overrides,
  };
}

function cardData(email: string, overrides: Record<string, unknown> = {}) {
  return {
    stage: "request",
    title: "교육 정보 확인",
    order: 1024,
    assigneeEmail: null,
    dueDate: null,
    memo: "",
    done: false,
    deletedAt: null,
    deletedBy: null,
    ...stamps(email),
    ...overrides,
  };
}

function itemData(email: string, overrides: Record<string, unknown> = {}) {
  return { cardId: "card1", text: "대상", done: false, order: 1024, ...stamps(email), ...overrides };
}

function sessionData(email: string, overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-10-20",
    startTime: "09:30",
    location: "본사 3층",
    audience: "신입사원 30명",
    note: "",
    ...stamps(email),
    ...overrides,
  };
}

function seededMember(email: string, role: "admin" | "instructor") {
  return {
    email,
    role,
    displayName: "",
    photoURL: "",
    uid: null,
    invitedBy: ADMIN,
    invitedAt: Timestamp.now(),
    lastLoginAt: null,
  };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-edu-project",
    firestore: { rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, "members", ADMIN), seededMember(ADMIN, "admin"));
    await setDoc(doc(db, "members", TEACHER), seededMember(TEACHER, "instructor"));
    await setDoc(doc(db, "members", TEACHER2), seededMember(TEACHER2, "instructor"));
    await setDoc(doc(db, "courses", COURSE), {
      ...courseData(TEACHER),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "courses", COURSE, "cards", "card1"), {
      ...cardData(TEACHER),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "courses", COURSE, "checklistItems", "item1"), {
      ...itemData(TEACHER),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "courses", COURSE, "checklistItems", "item2"), {
      ...itemData(TEACHER, { text: "인원", order: 2048 }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, "courses", COURSE, "sessions", "session1"), {
      ...sessionData(TEACHER),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
});

describe("로그인과 초대", () => {
  it("로그인하지 않으면 아무것도 못 읽는다", async () => {
    await assertFails(getDoc(doc(anonymousDb(), "courses", COURSE)));
    await assertFails(getDoc(doc(anonymousDb(), "members", ADMIN)));
  });

  it("초대받지 않은 사람도 자기 팀원 문서 경로는 읽을 수 있다 (초대 여부 확인용)", async () => {
    const db = dbAs(STRANGER);
    const snapshot = await assertSucceeds(getDoc(doc(db, "members", STRANGER)));
    if (snapshot.exists()) throw new Error("문서가 없어야 합니다");
  });

  it("초대받지 않은 사람은 다른 팀원·과정·목록을 못 읽는다", async () => {
    const db = dbAs(STRANGER);
    await assertFails(getDoc(doc(db, "members", ADMIN)));
    await assertFails(getDocs(collection(db, "members")));
    await assertFails(getDoc(doc(db, "courses", COURSE)));
    await assertFails(getDocs(collection(db, "courses")));
  });

  it("이메일 인증이 안 된 계정은 팀원이어도 막힌다", async () => {
    const db = dbAs(TEACHER, { verified: false });
    await assertFails(getDoc(doc(db, "courses", COURSE)));
  });

  it("대문자 이메일 토큰도 소문자 문서로 인식한다", async () => {
    const db = dbAs("Teacher@Example.com");
    await assertSucceeds(getDoc(doc(db, "courses", COURSE)));
  });

  it("팀원은 팀원 목록과 과정을 읽는다", async () => {
    const db = dbAs(TEACHER);
    await assertSucceeds(getDocs(collection(db, "members")));
    await assertSucceeds(getDocs(collection(db, "courses")));
    await assertSucceeds(getDocs(collection(db, "courses", COURSE, "cards")));
  });

  it("규칙에 없는 컬렉션은 막힌다", async () => {
    await assertFails(setDoc(doc(dbAs(ADMIN), "secrets", "x"), { a: 1 }));
    await assertFails(getDoc(doc(dbAs(ADMIN), "secrets", "x")));
  });
});

describe("첫 관리자", () => {
  function bootstrapDoc(overrides: Record<string, unknown> = {}) {
    return {
      email: BOOTSTRAP_ADMIN_EMAIL,
      role: "admin",
      invitedBy: BOOTSTRAP_ADMIN_EMAIL,
      invitedAt: serverTimestamp(),
      uid: `uid-${BOOTSTRAP_ADMIN_EMAIL}`,
      displayName: "관리자",
      photoURL: "",
      lastLoginAt: serverTimestamp(),
      ...overrides,
    };
  }

  it("첫 관리자는 자기 관리자 문서를 만들 수 있다", async () => {
    const db = dbAs(BOOTSTRAP_ADMIN_EMAIL);
    await assertSucceeds(setDoc(doc(db, "members", BOOTSTRAP_ADMIN_EMAIL), bootstrapDoc()));
  });

  it("강사 역할이나 다른 uid로는 만들 수 없다", async () => {
    const db = dbAs(BOOTSTRAP_ADMIN_EMAIL);
    await assertFails(setDoc(doc(db, "members", BOOTSTRAP_ADMIN_EMAIL), bootstrapDoc({ role: "instructor" })));
    await assertFails(setDoc(doc(db, "members", BOOTSTRAP_ADMIN_EMAIL), bootstrapDoc({ uid: "someone-else" })));
  });

  it("다른 사람은 스스로 팀원 문서를 만들 수 없다", async () => {
    const db = dbAs(STRANGER);
    await assertFails(
      setDoc(doc(db, "members", STRANGER), {
        ...bootstrapDoc(),
        email: STRANGER,
        invitedBy: STRANGER,
        uid: `uid-${STRANGER}`,
      }),
    );
  });

  it("첫 관리자는 문서가 없어도 관리자 권한이 있다", async () => {
    const db = dbAs(BOOTSTRAP_ADMIN_EMAIL);
    await assertSucceeds(
      setDoc(doc(db, "members", "new@example.com"), {
        email: "new@example.com",
        role: "instructor",
        displayName: "",
        photoURL: "",
        uid: null,
        invitedBy: BOOTSTRAP_ADMIN_EMAIL,
        invitedAt: serverTimestamp(),
        lastLoginAt: null,
      }),
    );
  });
});

describe("팀 관리", () => {
  function invite(email: string, by: string, overrides: Record<string, unknown> = {}) {
    return {
      email,
      role: "instructor",
      displayName: "",
      photoURL: "",
      uid: null,
      invitedBy: by,
      invitedAt: serverTimestamp(),
      lastLoginAt: null,
      ...overrides,
    };
  }

  it("관리자는 강사를 초대한다", async () => {
    await assertSucceeds(setDoc(doc(dbAs(ADMIN), "members", "new@example.com"), invite("new@example.com", ADMIN)));
  });

  it("강사는 초대할 수 없다", async () => {
    await assertFails(setDoc(doc(dbAs(TEACHER), "members", "new@example.com"), invite("new@example.com", TEACHER)));
  });

  it("초대 문서 모양이 다르면 막힌다 (대문자 id, 이메일 불일치, 남의 이름으로 초대, 잘못된 역할)", async () => {
    const db = dbAs(ADMIN);
    await assertFails(setDoc(doc(db, "members", "New@example.com"), invite("New@example.com", ADMIN)));
    await assertFails(setDoc(doc(db, "members", "a@example.com"), invite("b@example.com", ADMIN)));
    await assertFails(setDoc(doc(db, "members", "a@example.com"), invite("a@example.com", TEACHER)));
    await assertFails(setDoc(doc(db, "members", "a@example.com"), invite("a@example.com", ADMIN, { role: "owner" })));
    await assertFails(setDoc(doc(db, "members", "a@example.com"), invite("a@example.com", ADMIN, { uid: "x" })));
  });

  it("본인은 로그인 때 프로필만 갱신한다", async () => {
    const db = dbAs(TEACHER);
    await assertSucceeds(
      updateDoc(doc(db, "members", TEACHER), {
        uid: `uid-${TEACHER}`,
        displayName: "김강사",
        photoURL: "https://example.com/p.png",
        lastLoginAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(db, "members", TEACHER), { role: "admin" }));
    await assertFails(
      updateDoc(doc(db, "members", TEACHER), {
        uid: "someone-else",
        displayName: "",
        photoURL: "",
        lastLoginAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "members", TEACHER2), {
        uid: `uid-${TEACHER}`,
        displayName: "",
        photoURL: "",
        lastLoginAt: serverTimestamp(),
      }),
    );
  });

  it("관리자는 다른 사람의 역할을 바꾸지만, 자기 자신·첫 관리자의 역할은 못 바꾼다", async () => {
    const db = dbAs(ADMIN);
    await assertSucceeds(updateDoc(doc(db, "members", TEACHER), { role: "admin" }));
    await assertFails(updateDoc(doc(db, "members", ADMIN), { role: "instructor" }));
    await env.withSecurityRulesDisabled(async (context) => {
      const raw = context.firestore() as unknown as Firestore;
      await setDoc(doc(raw, "members", BOOTSTRAP_ADMIN_EMAIL), seededMember(BOOTSTRAP_ADMIN_EMAIL, "admin"));
    });
    await assertFails(updateDoc(doc(db, "members", BOOTSTRAP_ADMIN_EMAIL), { role: "instructor" }));
    await assertFails(updateDoc(doc(db, "members", TEACHER2), { role: "instructor", email: "x@example.com" }));
  });

  it("강사는 역할을 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(dbAs(TEACHER), "members", TEACHER2), { role: "admin" }));
  });

  it("관리자는 다른 사람을 내보내지만, 자기 자신·첫 관리자는 못 내보낸다", async () => {
    const db = dbAs(ADMIN);
    await assertSucceeds(deleteDoc(doc(db, "members", TEACHER)));
    await assertFails(deleteDoc(doc(db, "members", ADMIN)));
    await assertFails(deleteDoc(doc(db, "members", BOOTSTRAP_ADMIN_EMAIL)));
    await assertFails(deleteDoc(doc(dbAs(TEACHER2), "members", ADMIN)));
  });

  it("내보낸 사람은 더 이상 과정을 못 읽는다", async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(ADMIN), "members", TEACHER)));
    await assertFails(getDoc(doc(dbAs(TEACHER), "courses", COURSE)));
  });
});

describe("과정", () => {
  it("팀원은 과정을 만든다", async () => {
    await assertSucceeds(setDoc(doc(dbAs(TEACHER), "courses", "c2"), courseData(TEACHER)));
  });

  it("만든 사람을 남으로 적거나, 보관 상태로 만들거나, 모르는 칸을 넣으면 막힌다", async () => {
    const db = dbAs(TEACHER);
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { createdBy: ADMIN })));
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { status: "archived" })));
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { owner: "x" })));
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { deletedAt: serverTimestamp() })));
  });

  it("길이·형식 제한", async () => {
    const db = dbAs(TEACHER);
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { title: "" })));
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { title: "가".repeat(101) })));
    await assertSucceeds(setDoc(doc(db, "courses", "c3"), courseData(TEACHER, { title: "가".repeat(100) })));
    await assertFails(
      setDoc(
        doc(db, "courses", "c2"),
        courseData(TEACHER, { instructorEmails: Array.from({ length: 21 }, (_, i) => `u${i}@a.com`) }),
      ),
    );
    await assertFails(setDoc(doc(db, "courses", "c2"), courseData(TEACHER, { instructorEmails: "x" })));
  });

  it("팀원은 과정 정보를 고치고 보관·복귀한다", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(updateDoc(doc(db, "courses", COURSE), { title: "새 이름", ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(doc(db, "courses", COURSE), { status: "archived", ...touch(TEACHER2) }));
    await assertSucceeds(updateDoc(doc(db, "courses", COURSE), { status: "active", ...touch(TEACHER2) }));
  });

  it("고친 사람·시각을 남기지 않거나 만든 사람을 바꾸면 막힌다", async () => {
    const db = dbAs(TEACHER2);
    await assertFails(updateDoc(doc(db, "courses", COURSE), { title: "새 이름" }));
    await assertFails(updateDoc(doc(db, "courses", COURSE), { title: "새 이름", ...touch(TEACHER) }));
    await assertFails(updateDoc(doc(db, "courses", COURSE), { createdBy: TEACHER2, ...touch(TEACHER2) }));
    await assertFails(updateDoc(doc(db, "courses", COURSE), { status: "deleted", ...touch(TEACHER2) }));
  });

  it("휴지통 넣기·되살리기는 관리자만", async () => {
    await assertFails(
      updateDoc(doc(dbAs(TEACHER), "courses", COURSE), {
        deletedAt: serverTimestamp(),
        deletedBy: TEACHER,
        ...touch(TEACHER),
      }),
    );
    const admin = dbAs(ADMIN);
    await assertSucceeds(
      updateDoc(doc(admin, "courses", COURSE), { deletedAt: serverTimestamp(), deletedBy: ADMIN, ...touch(ADMIN) }),
    );
    // 휴지통에 있는 과정은 강사가 고칠 수 없다
    await assertFails(updateDoc(doc(dbAs(TEACHER), "courses", COURSE), { title: "x", ...touch(TEACHER) }));
    await assertSucceeds(
      updateDoc(doc(admin, "courses", COURSE), { deletedAt: null, deletedBy: null, ...touch(ADMIN) }),
    );
  });

  it("휴지통 표시는 지금 시각·본인이어야 한다", async () => {
    const admin = dbAs(ADMIN);
    await assertFails(
      updateDoc(doc(admin, "courses", COURSE), { deletedAt: serverTimestamp(), deletedBy: TEACHER, ...touch(ADMIN) }),
    );
    // 지어낸 시각은 확실히 과거로 둔다. Timestamp.now()는 에뮬레이터의 request.time과 우연히 같아질 수 있다.
    await assertFails(
      updateDoc(doc(admin, "courses", COURSE), {
        deletedAt: Timestamp.fromMillis(Date.now() - 60_000),
        deletedBy: ADMIN,
        ...touch(ADMIN),
      }),
    );
  });

  it("완전 삭제는 누구도 못 한다 (지우기는 휴지통 표시로만)", async () => {
    await assertFails(deleteDoc(doc(dbAs(TEACHER), "courses", COURSE)));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "courses", COURSE)));
  });

  it("과정 만들기 묶음 쓰기(기본 카드·체크리스트·회차)가 한 번에 통과한다", async () => {
    const db = dbAs(TEACHER);
    const batch = writeBatch(db);
    batch.set(doc(db, "courses", "batchCourse"), courseData(TEACHER));
    let cardIndex = 0;
    for (const template of DEFAULT_TEMPLATE) {
      cardIndex += 1;
      const cardId = `card-${cardIndex}`;
      batch.set(
        doc(db, "courses", "batchCourse", "cards", cardId),
        cardData(TEACHER, { stage: template.stage, title: template.title, order: cardIndex * 1024 }),
      );
      template.checklist.forEach((text, itemIndex) => {
        batch.set(
          doc(db, "courses", "batchCourse", "checklistItems", `${cardId}-${itemIndex}`),
          itemData(TEACHER, { cardId, text, order: (itemIndex + 1) * 1024 }),
        );
      });
    }
    batch.set(doc(db, "courses", "batchCourse", "sessions", "s1"), sessionData(TEACHER));
    await assertSucceeds(batch.commit());
  });
});

describe("카드", () => {
  const cardPath = ["courses", COURSE, "cards"] as const;

  it("팀원은 카드를 만들고, 잘못된 값은 막힌다", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(setDoc(doc(db, ...cardPath, "c2"), cardData(TEACHER2)));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { stage: "unknown" })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { title: "" })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { dueDate: "10/20" })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { assigneeEmail: "not-email" })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { order: "1" })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { memo: "가".repeat(5001) })));
    await assertFails(setDoc(doc(db, ...cardPath, "c3"), cardData(TEACHER2, { createdBy: TEACHER })));
  });

  it("고치기·단계 이동·완료", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(
      updateDoc(doc(db, ...cardPath, "card1"), { stage: "lecture", order: 1.5, ...touch(TEACHER2) }),
    );
    await assertSucceeds(
      updateDoc(doc(db, ...cardPath, "card1"), {
        done: true,
        assigneeEmail: TEACHER2,
        dueDate: "2026-10-20",
        ...touch(TEACHER2),
      }),
    );
    await assertFails(updateDoc(doc(db, ...cardPath, "card1"), { createdAt: serverTimestamp(), ...touch(TEACHER2) }));
  });

  it("휴지통 표시와 되살리기는 팀원 누구나, 본인·지금 시각으로", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(
      updateDoc(doc(db, ...cardPath, "card1"), { deletedAt: serverTimestamp(), deletedBy: TEACHER2, ...touch(TEACHER2) }),
    );
    await assertSucceeds(
      updateDoc(doc(db, ...cardPath, "card1"), { deletedAt: null, deletedBy: null, ...touch(TEACHER2) }),
    );
    await assertFails(
      updateDoc(doc(db, ...cardPath, "card1"), { deletedAt: serverTimestamp(), deletedBy: ADMIN, ...touch(TEACHER2) }),
    );
  });

  it("초대받지 않은 사람은 카드를 못 만든다", async () => {
    await assertFails(setDoc(doc(dbAs(STRANGER), ...cardPath, "c9"), cardData(STRANGER)));
  });
});

describe("체크리스트", () => {
  const itemPath = ["courses", COURSE, "checklistItems"] as const;

  it("두 사람이 각자 다른 항목을 체크해도 둘 다 남는다", async () => {
    const first = dbAs(TEACHER);
    const second = dbAs(TEACHER2);
    await Promise.all([
      assertSucceeds(updateDoc(doc(first, ...itemPath, "item1"), { done: true, ...touch(TEACHER) })),
      assertSucceeds(updateDoc(doc(second, ...itemPath, "item2"), { done: true, ...touch(TEACHER2) })),
    ]);
    const one = await getDoc(doc(first, ...itemPath, "item1"));
    const two = await getDoc(doc(first, ...itemPath, "item2"));
    if (one.data()?.done !== true || two.data()?.done !== true) {
      throw new Error("두 체크가 모두 남아야 합니다");
    }
  });

  it("항목 추가·글 고치기·순서·삭제", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(setDoc(doc(db, ...itemPath, "item3"), itemData(TEACHER2)));
    await assertSucceeds(updateDoc(doc(db, ...itemPath, "item3"), { text: "시간", order: 512, ...touch(TEACHER2) }));
    await assertSucceeds(deleteDoc(doc(db, ...itemPath, "item3")));
  });

  it("다른 카드로 옮기기, 빈 글, 처음부터 체크된 항목은 막힌다", async () => {
    const db = dbAs(TEACHER2);
    await assertFails(updateDoc(doc(db, ...itemPath, "item1"), { cardId: "other", ...touch(TEACHER2) }));
    await assertFails(updateDoc(doc(db, ...itemPath, "item1"), { text: "", ...touch(TEACHER2) }));
    await assertFails(setDoc(doc(db, ...itemPath, "item4"), itemData(TEACHER2, { done: true })));
    await assertFails(setDoc(doc(db, ...itemPath, "item4"), itemData(TEACHER2, { text: "가".repeat(301) })));
  });
});

describe("회차", () => {
  const sessionPath = ["courses", COURSE, "sessions"] as const;

  it("팀원은 회차를 추가·수정·삭제한다", async () => {
    const db = dbAs(TEACHER2);
    await assertSucceeds(setDoc(doc(db, ...sessionPath, "s2"), sessionData(TEACHER2, { startTime: null })));
    await assertSucceeds(updateDoc(doc(db, ...sessionPath, "s2"), { location: "온라인", ...touch(TEACHER2) }));
    await assertSucceeds(deleteDoc(doc(db, ...sessionPath, "s2")));
  });

  it("날짜·시간 형식이 틀리면 막힌다", async () => {
    const db = dbAs(TEACHER2);
    await assertFails(setDoc(doc(db, ...sessionPath, "s3"), sessionData(TEACHER2, { date: "2026/10/20" })));
    await assertFails(setDoc(doc(db, ...sessionPath, "s3"), sessionData(TEACHER2, { startTime: "9:30" })));
    await assertFails(setDoc(doc(db, ...sessionPath, "s3"), sessionData(TEACHER2, { note: "가".repeat(1001) })));
  });
});
