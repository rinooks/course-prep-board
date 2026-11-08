import { describe, expect, it } from "vitest";
import {
  buildNotices,
  courseLabel,
  lecturesOn,
  noticeBadgeText,
  noticeCountLabel,
  overdueFeeItems,
  type NoticeCourse,
  type NoticeFee,
  type NoticeMember,
  type NoticeSession,
} from "@/lib/domain/notices";

// 2026-10-12는 월요일, 내일은 2026-10-13 (화)
const TODAY = "2026-10-12";
const TOMORROW = "2026-10-13";
const ME = "kim@example.com";
const OTHER = "lee@example.com";
const ADMIN = "boss@example.com";

function course(overrides: Partial<NoticeCourse> & Pick<NoticeCourse, "id">): NoticeCourse {
  return {
    title: "신입사원 입문 과정",
    client: "A사",
    instructorEmails: [ME],
    status: "active",
    deletedAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<NoticeSession> & Pick<NoticeSession, "id">): NoticeSession {
  return { date: TOMORROW, startTime: null, location: "", audience: "", ...overrides };
}

function fee(overrides: Partial<NoticeFee> & Pick<NoticeFee, "id">): NoticeFee {
  return {
    courseId: "c1",
    instructorEmail: ME,
    label: "1회차",
    amount: 1_200_000,
    dueDate: "2026-10-01",
    paidDate: null,
    ...overrides,
  };
}

const MEMBERS: NoticeMember[] = [
  { email: ME, role: "instructor", displayName: "김강사" },
  { email: OTHER, role: "instructor", displayName: "" },
  { email: ADMIN, role: "admin", displayName: "관리자" },
];

describe("과정 이름", () => {
  it("고객사 이름을 앞에 붙이고, 과정 이름에 이미 있으면 붙이지 않는다", () => {
    expect(courseLabel({ title: "신입사원 입문 과정", client: "A사" })).toBe("A사 신입사원 입문 과정");
    expect(courseLabel({ title: "A사 리더십 과정", client: "A사" })).toBe("A사 리더십 과정");
    expect(courseLabel({ title: "공개 과정", client: "  " })).toBe("공개 과정");
  });
});

describe("내일 강의", () => {
  it("진행 중이고 휴지통에 없는 과정의 그 날 회차만, 시간 순(시간 없으면 뒤)으로 준다", () => {
    const courses = [
      course({ id: "c1" }),
      course({ id: "c2", title: "보관한 과정", status: "archived" }),
      course({ id: "c3", title: "지운 과정", deletedAt: 123 }),
      course({ id: "c4", title: "오후 과정", client: "" }),
    ];
    const items = lecturesOn(TOMORROW, courses, {
      c1: [session({ id: "s1", startTime: null }), session({ id: "s0", date: TODAY })],
      c2: [session({ id: "s2" })],
      c3: [session({ id: "s3" })],
      c4: [session({ id: "s4", startTime: "13:00" })],
    });
    expect(items.map((item) => item.session.id)).toEqual(["s4", "s1"]);
  });

  it("내가 담당 강사인 과정의 내일 회차를 알린다 (다른 사람 과정은 알리지 않는다)", () => {
    const notices = buildNotices({
      email: ME,
      isAdmin: false,
      today: TODAY,
      courses: [course({ id: "c1" }), course({ id: "c2", title: "남의 과정", instructorEmails: [OTHER] })],
      sessionsByCourse: {
        c1: [session({ id: "s1", startTime: "09:30", location: "본사 3층", audience: "신입사원 30명" })],
        c2: [session({ id: "s2", startTime: "10:00" })],
      },
      fees: [],
      members: [],
    });
    expect(notices).toEqual([
      {
        id: "lecture:c1:s1",
        kind: "lecture",
        label: "내일 강의",
        text: "내일 09:30 A사 신입사원 입문 과정",
        detail: "본사 3층 · 신입사원 30명",
        href: "/courses/c1",
      },
    ]);
  });

  it("시간이 없으면 날짜만 쓰고, 장소·대상이 없으면 둘째 줄을 비운다", () => {
    const [notice] = buildNotices({
      email: ME,
      isAdmin: false,
      today: TODAY,
      courses: [course({ id: "c1" })],
      sessionsByCourse: { c1: [session({ id: "s1" })] },
      fees: [],
      members: [],
    });
    expect(notice.text).toBe("내일 A사 신입사원 입문 과정");
    expect(notice.detail).toBe("");
  });
});

describe("미입금 강사료", () => {
  const courses = [course({ id: "c1" }), course({ id: "c2", title: "보관 과정", client: "", status: "archived" })];

  it("예정일이 지나고 입금 전인 것만, 오래 밀린 순으로 준다 (과정이 없거나 휴지통이면 뺀다)", () => {
    const items = overdueFeeItems(
      [
        fee({ id: "today", dueDate: TODAY }),
        fee({ id: "paid", dueDate: "2026-10-01", paidDate: "2026-10-05" }),
        fee({ id: "recent", dueDate: "2026-10-10" }),
        fee({ id: "old", dueDate: "2026-09-01", courseId: "c2" }),
        fee({ id: "noCourse", courseId: "missing" }),
        fee({ id: "badDate", dueDate: "2026-13-40" }),
      ],
      [...courses, course({ id: "trashed", deletedAt: 1 })],
      TODAY,
    );
    expect(items.map((item) => [item.fee.id, item.days])).toEqual([
      ["old", 41],
      ["recent", 2],
    ]);
  });

  it("강사는 자기 강사료만 본다 (다른 사람 것이 섞여 들어와도 뺀다)", () => {
    const notices = buildNotices({
      email: ME,
      isAdmin: false,
      today: TODAY,
      courses,
      sessionsByCourse: {},
      fees: [fee({ id: "mine" }), fee({ id: "theirs", instructorEmail: OTHER })],
      members: MEMBERS,
    });
    expect(notices).toEqual([
      {
        id: "fee:mine",
        kind: "overdueFee",
        label: "미입금",
        text: "A사 신입사원 입문 과정 1회차 1,200,000원",
        detail: "입금 예정일 10월 1일 (목) · 11일 지남",
        href: "/fees?status=overdue",
      },
    ]);
  });

  it("관리자는 모두의 미입금 강사료를 강사 이름과 함께 본다 (이름이 없으면 이메일, 내 것은 '내 강사료')", () => {
    const notices = buildNotices({
      email: ADMIN,
      isAdmin: true,
      today: TODAY,
      courses,
      sessionsByCourse: {},
      fees: [
        fee({ id: "kim", dueDate: "2026-10-05" }),
        fee({ id: "lee", instructorEmail: OTHER, label: "", courseId: "c2" }),
        fee({ id: "own", instructorEmail: ADMIN, dueDate: "2026-10-11" }),
      ],
      members: MEMBERS,
    });
    expect(notices.map((notice) => [notice.id, notice.text, notice.detail])).toEqual([
      ["fee:lee", "보관 과정 1,200,000원", `입금 예정일 10월 1일 (목) · 11일 지남 · ${OTHER}`],
      ["fee:kim", "A사 신입사원 입문 과정 1회차 1,200,000원", "입금 예정일 10월 5일 (월) · 7일 지남 · 김강사"],
      ["fee:own", "A사 신입사원 입문 과정 1회차 1,200,000원", "입금 예정일 10월 11일 (일) · 1일 지남 · 내 강사료"],
    ]);
  });

  it("내일 강의가 먼저, 그다음 미입금 강사료", () => {
    const notices = buildNotices({
      email: ME,
      isAdmin: false,
      today: TODAY,
      courses,
      sessionsByCourse: { c1: [session({ id: "s1", startTime: "09:30" })] },
      fees: [fee({ id: "f1" })],
      members: [],
    });
    expect(notices.map((notice) => notice.kind)).toEqual(["lecture", "overdueFee"]);
  });
});

describe("종 버튼 표시", () => {
  it("화면 낭독기 이름과 배지 숫자", () => {
    expect(noticeCountLabel(0)).toBe("새 알림 없음");
    expect(noticeCountLabel(3)).toBe("알림 3개");
    expect(noticeBadgeText(9)).toBe("9");
    expect(noticeBadgeText(12)).toBe("9+");
  });
});
