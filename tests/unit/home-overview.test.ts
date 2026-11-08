import { describe, expect, it } from "vitest";
import {
  agendaInScope,
  averagePercent,
  buildAgenda,
  buildCourseOverviews,
  courseIdsKey,
  coursesInScope,
} from "@/components/home/homeOverview";
import { epochDateLabel, instructorSummary, sessionPlaceLabel, sessionWhenLabel } from "@/components/home/labels";
import { msUntilNextSeoulMidnight } from "@/components/home/today";
import type { CourseDetail } from "@/lib/data/overview";
import type { Course, Member } from "@/lib/data/types";
import { summarizeProgress } from "@/lib/domain/progress";
import { makeCard, makeSession } from "./fixtures";

// 2026-10-11은 일요일이다
const today = "2026-10-11";

function makeCourse(overrides: Partial<Course> & Pick<Course, "id" | "title">): Course {
  return {
    client: "",
    description: "",
    instructorEmails: [],
    status: "active",
    deletedAt: null,
    deletedBy: null,
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}

function makeMember(email: string, displayName = ""): Member {
  return {
    email,
    role: "instructor",
    displayName,
    photoURL: "",
    uid: null,
    invitedBy: "admin@example.com",
    invitedAt: 0,
    lastLoginAt: null,
  };
}

const courseA = makeCourse({ id: "a", title: "가 과정" });
const courseB = makeCourse({ id: "b", title: "나 과정" });
const courseC = makeCourse({ id: "c", title: "다 과정" });

const details: Record<string, CourseDetail> = {
  a: {
    loaded: true,
    cards: [
      makeCard({ id: "a1", courseId: "a", stage: "request", done: true }),
      makeCard({ id: "a2", courseId: "a", stage: "curriculum", dueDate: "2026-10-09" }),
      makeCard({ id: "a3", courseId: "a", stage: "lecture", dueDate: "2026-10-20" }),
    ],
    sessions: [
      makeSession({ id: "a-past", courseId: "a", date: "2026-10-01" }),
      makeSession({ id: "a-next", courseId: "a", date: "2026-10-20" }),
    ],
    events: [],
  },
  b: {
    loaded: true,
    cards: [
      makeCard({ id: "b1", courseId: "b", stage: "request", dueDate: "2026-10-12" }),
      makeCard({ id: "b2", courseId: "b", stage: "request", dueDate: "2026-10-11", deletedAt: 5 }),
      makeCard({ id: "b3", courseId: "b", stage: "request", dueDate: "2026-10-13", done: true }),
    ],
    sessions: [
      makeSession({ id: "b-tomorrow", courseId: "b", date: "2026-10-12", startTime: "09:30" }),
      makeSession({ id: "b-today", courseId: "b", date: today, startTime: "14:00" }),
    ],
    events: [],
  },
  c: { loaded: false, cards: [], sessions: [], events: [] },
};

describe("buildCourseOverviews", () => {
  it("다음 강의가 가까운 순, 일정 없는 과정은 뒤에 둔다", () => {
    const result = buildCourseOverviews([courseC, courseA, courseB], details, today);
    expect(result.map((item) => item.course.id)).toEqual(["b", "a", "c"]);
  });

  it("진행률·현재 단계·다음 강의를 계산한다 (휴지통 카드 제외)", () => {
    const [b, a, c] = buildCourseOverviews([courseA, courseB, courseC], details, today);
    expect(a.progress.doneCards).toBe(1);
    expect(a.progress.totalCards).toBe(3);
    expect(a.progress.currentStageId).toBe("curriculum");
    expect(a.nextSession?.id).toBe("a-next");
    expect(b.progress.totalCards).toBe(2);
    expect(b.nextSession?.id).toBe("b-today");
    expect(c.loaded).toBe(false);
    expect(c.nextSession).toBeNull();
  });

  it("아직 받지 못한 과정은 loaded=false", () => {
    const [only] = buildCourseOverviews([makeCourse({ id: "x", title: "새 과정" })], {}, today);
    expect(only.loaded).toBe(false);
    expect(only.progress.totalCards).toBe(0);
  });
});

describe("buildAgenda", () => {
  const agenda = buildAgenda([courseA, courseB, courseC], details, today);

  it("오늘부터 7일(오늘 포함) 범위를 쓴다 — 일요일에도 내일(월) 강의가 보인다", () => {
    expect(agenda.range).toEqual({ start: "2026-10-11", end: "2026-10-17" });
    expect(agenda.days.map((day) => day.date)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(agenda.sessionCount).toBe(2);
    expect(agenda.days[0].sessions[0].course.id).toBe("b");
  });

  it("기간 밖·지난 회차는 뺀다", () => {
    const ids = agenda.days.flatMap((day) => day.sessions.map((item) => item.session.id));
    expect(ids).not.toContain("a-past");
    expect(ids).not.toContain("a-next");
  });

  it("마감 카드: 지난 것 포함, 끝난 카드·휴지통 카드·기간 밖은 뺀다", () => {
    expect(agenda.dueCards.map((item) => item.card.id)).toEqual(["a2", "b1"]);
    expect(agenda.dueCards[0].course.title).toBe("가 과정");
  });

  it("과정 목록에 없는 과정(보관 등)의 일정은 넣지 않는다", () => {
    const onlyA = buildAgenda([courseA], details, today);
    expect(onlyA.sessionCount).toBe(0);
    expect(onlyA.dueCards.map((item) => item.card.id)).toEqual(["a2"]);
  });
});

describe("courseIdsKey", () => {
  it("순서와 무관하게 같은 문자열", () => {
    expect(courseIdsKey([courseB, courseA])).toBe(courseIdsKey([courseA, courseB]));
    expect(courseIdsKey([])).toBe("");
  });
});

describe("labels", () => {
  const members = [makeMember("kim@example.com", "김강사"), makeMember("lee@example.com")];

  it("담당 강사: 이름 우선, 없으면 이메일, 많으면 외 N명", () => {
    expect(instructorSummary([], members)).toBe("지정 안 됨");
    expect(instructorSummary(["kim@example.com", "lee@example.com"], members)).toBe(
      "김강사, lee@example.com",
    );
    expect(
      instructorSummary(["kim@example.com", "a@x.com", "b@x.com", "c@x.com", "d@x.com"], members),
    ).toBe("김강사, a@x.com, b@x.com 외 2명");
  });

  it("회차 날짜·장소 표시", () => {
    expect(sessionWhenLabel({ date: "2026-10-15", startTime: "09:30" })).toBe("10월 15일 (목) 09:30");
    expect(sessionWhenLabel({ date: "2026-10-15", startTime: null })).toBe("10월 15일 (목)");
    expect(sessionPlaceLabel({ location: "본사", audience: "" })).toBe("본사");
    expect(sessionPlaceLabel({ location: "본사", audience: "신입 30명" })).toBe("본사 · 신입 30명");
    expect(sessionPlaceLabel({ location: " ", audience: "" })).toBe("");
  });

  it("epoch 밀리초를 한국 날짜로 (UTC 밤 = 한국 다음 날)", () => {
    // 2026-10-10T20:00:00Z = 한국 2026-10-11 05:00
    expect(epochDateLabel(Date.UTC(2026, 9, 10, 20, 0, 0))).toBe("2026년 10월 11일 (일)");
    expect(epochDateLabel(null)).toBeNull();
  });
});

describe("msUntilNextSeoulMidnight", () => {
  it("한국 자정까지 남은 시간", () => {
    // 한국 2026-10-11 23:00 = UTC 14:00 → 1시간 남음
    expect(msUntilNextSeoulMidnight(Date.UTC(2026, 9, 11, 14, 0, 0))).toBe(60 * 60 * 1000);
    // 한국 자정 정각이면 하루 뒤
    expect(msUntilNextSeoulMidnight(Date.UTC(2026, 9, 11, 15, 0, 0))).toBe(24 * 60 * 60 * 1000);
  });
});

describe("coursesInScope / agendaInScope (내 것만 보기)", () => {
  const me = "me@example.com";
  const mineA = makeCourse({ id: "a", title: "가 과정", instructorEmails: ["Me@Example.com", "x@example.com"] });
  const otherB = makeCourse({ id: "b", title: "나 과정", instructorEmails: ["x@example.com"] });
  const scopedDetails: Record<string, CourseDetail> = {
    a: {
      loaded: true,
      cards: [
        makeCard({ id: "a-mine", courseId: "a", dueDate: "2026-10-12", assigneeEmail: me }),
        makeCard({ id: "a-other", courseId: "a", dueDate: "2026-10-12", assigneeEmail: "x@example.com" }),
        makeCard({ id: "a-nobody", courseId: "a", dueDate: "2026-10-12" }),
      ],
      sessions: [makeSession({ id: "a-s", courseId: "a", date: "2026-10-13" })],
      events: [],
    },
    b: {
      loaded: true,
      // 담당 강사가 아닌 과정이라도 나에게 맡긴 카드는 내 일이다
      cards: [makeCard({ id: "b-mine", courseId: "b", dueDate: "2026-10-10", assigneeEmail: me })],
      sessions: [makeSession({ id: "b-s", courseId: "b", date: "2026-10-12" })],
      events: [],
    },
  };
  const teamAgenda = buildAgenda([mineA, otherB], scopedDetails, today);

  it("팀 전체면 과정과 일정을 그대로 둔다", () => {
    expect(coursesInScope([mineA, otherB], "team", me)).toEqual([mineA, otherB]);
    expect(agendaInScope(teamAgenda, "team", me)).toBe(teamAgenda);
  });

  it("내 것만: 내가 담당 강사인 과정만 남긴다 (이메일 대소문자 무시)", () => {
    expect(coursesInScope([mineA, otherB], "mine", me).map((course) => course.id)).toEqual(["a"]);
  });

  it("내 것만: 강의는 내 과정 것만, 마감 카드는 어느 과정이든 나에게 맡긴 것만", () => {
    const mine = agendaInScope(teamAgenda, "mine", me);
    expect(mine.range).toEqual(teamAgenda.range);
    expect(mine.days.map((day) => day.date)).toEqual(["2026-10-13"]);
    expect(mine.sessionCount).toBe(1);
    expect(mine.dueCards.map((item) => item.card.id)).toEqual(["b-mine", "a-mine"]);
  });
});

describe("averagePercent", () => {
  // 평균 계산은 percent만 보므로, 빈 진행률에 percent만 바꿔 넣는다
  const progressOf = (percent: number) => ({ ...summarizeProgress([]), percent });

  it("진행률을 받은 과정만 평균 내고 소수점은 버린다", () => {
    expect(
      averagePercent([
        { loaded: true, progress: progressOf(50) },
        { loaded: true, progress: progressOf(25) },
        { loaded: false, progress: progressOf(0) },
      ]),
    ).toBe(37);
  });

  it("받은 과정이 없으면 null", () => {
    expect(averagePercent([{ loaded: false, progress: progressOf(0) }])).toBeNull();
    expect(averagePercent([])).toBeNull();
  });
});
