import { describe, expect, it } from "vitest";
import {
  buildDailyDigests,
  buildTestEmail,
  DEFAULT_APP_URL,
  digestSubject,
  escapeHtml,
  resolveAppUrl,
  type DigestInput,
} from "@/lib/domain/digest";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/domain/roles";
import type { NoticeCourse, NoticeFee, NoticeMember, NoticeSession } from "@/lib/domain/notices";

// 2026-10-12(월)에 보내는 메일. 내일은 2026-10-13(화)
const TODAY = "2026-10-12";
const TOMORROW = "2026-10-13";
const KIM = "kim@example.com";
const LEE = "lee@example.com";
const GONE = "gone@example.com"; // 팀에서 내보낸 강사 (members 문서 없음)
const ADMIN = "boss@example.com";

const MEMBERS: NoticeMember[] = [
  { email: KIM, role: "instructor", displayName: "김강사" },
  { email: LEE, role: "instructor", displayName: "" },
  { email: ADMIN, role: "admin", displayName: "관리자" },
];

function course(overrides: Partial<NoticeCourse> & Pick<NoticeCourse, "id">): NoticeCourse {
  return {
    title: "신입사원 입문 과정",
    client: "A사",
    instructorEmails: [KIM],
    status: "active",
    deletedAt: null,
    ...overrides,
  };
}

function session(overrides: Partial<NoticeSession> & Pick<NoticeSession, "id">): NoticeSession {
  return { date: TOMORROW, startTime: "09:30", location: "본사 3층", audience: "", ...overrides };
}

function fee(overrides: Partial<NoticeFee> & Pick<NoticeFee, "id">): NoticeFee {
  return {
    courseId: "c1",
    instructorEmail: KIM,
    label: "1회차",
    amount: 1_200_000,
    // 2026-10-11 예정 → 오늘이 1일째 (첫 알림 날)
    dueDate: "2026-10-11",
    paidDate: null,
    ...overrides,
  };
}

function input(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    today: TODAY,
    courses: [course({ id: "c1" })],
    sessionsByCourse: {},
    fees: [],
    members: MEMBERS,
    ...overrides,
  };
}

describe("받는 사람", () => {
  it("알릴 것이 없으면 메일이 없다", () => {
    expect(buildDailyDigests(input())).toEqual([]);
  });

  it("내일 강의는 그 과정의 담당 강사에게만 간다 (내보낸 강사는 빼고, 내일이 아닌 회차는 무시)", () => {
    const digests = buildDailyDigests(
      input({
        courses: [course({ id: "c1", instructorEmails: [KIM, GONE] }), course({ id: "c2", instructorEmails: [LEE] })],
        sessionsByCourse: {
          c1: [session({ id: "s1" })],
          c2: [session({ id: "s2", date: "2026-10-14" })],
        },
      }),
    );
    expect(digests.map((digest) => [digest.to, digest.lectureCount, digest.feeCount])).toEqual([[KIM, 1, 0]]);
    expect(digests[0].subject).toBe("[강의 준비 보드] 내일 강의 1건");
  });

  it("보관했거나 휴지통에 있는 과정의 회차는 알리지 않는다", () => {
    const digests = buildDailyDigests(
      input({
        courses: [course({ id: "c1", status: "archived" }), course({ id: "c2", deletedAt: 5 })],
        sessionsByCourse: { c1: [session({ id: "s1" })], c2: [session({ id: "s2" })] },
      }),
    );
    expect(digests).toEqual([]);
  });

  it("미입금 강사료는 강사 본인 + 모든 관리자(첫 관리자 포함)에게, 예정일 다음 날과 그 뒤 7일마다만 간다", () => {
    const digests = buildDailyDigests(
      input({
        fees: [
          fee({ id: "day1" }), // 1일째 → 보냄
          fee({ id: "day2", dueDate: "2026-10-10", instructorEmail: LEE }), // 2일째 → 안 보냄
          fee({ id: "day8", dueDate: "2026-10-04", instructorEmail: LEE }), // 8일째 → 보냄
          fee({ id: "paid", paidDate: "2026-10-12" }),
        ],
      }),
    );
    // 받는 사람 이메일 순: boss → kim → lee → owner(첫 관리자, members 문서가 없어도 받는다)
    expect(digests.map((digest) => [digest.to, digest.lectureCount, digest.feeCount])).toEqual([
      [ADMIN, 0, 2],
      [KIM, 0, 1],
      [LEE, 0, 1],
      [BOOTSTRAP_ADMIN_EMAIL, 0, 2],
    ]);
  });

  it("팀에서 내보낸 강사의 미입금 강사료는 관리자에게만 간다", () => {
    const digests = buildDailyDigests(input({ fees: [fee({ id: "f1", instructorEmail: GONE })] }));
    expect(digests.map((digest) => digest.to).sort()).toEqual([ADMIN, BOOTSTRAP_ADMIN_EMAIL].sort());
  });

  it("한 사람에게 내일 강의와 미입금 강사료를 한 통으로 모은다", () => {
    const digests = buildDailyDigests(
      input({ sessionsByCourse: { c1: [session({ id: "s1" })] }, fees: [fee({ id: "f1" }), fee({ id: "f2", label: "2회차" })] }),
    );
    const kim = digests.find((digest) => digest.to === KIM);
    expect(kim?.subject).toBe("[강의 준비 보드] 내일 강의 1건 · 미입금 강사료 2건");
    expect(kim?.text).toContain("■ 내일 강의 · 10월 13일 (화)");
    expect(kim?.text).toContain("- 09:30 A사 신입사원 입문 과정");
    expect(kim?.text).toContain("■ 미입금 강사료");
    expect(kim?.text).toContain("내 강사료 · 입금 예정일 10월 11일 (일) · 1일 지남");
    expect(kim?.text.startsWith("김강사님, 안녕하세요.")).toBe(true);
  });

  it("관리자 메일에는 강사 이름(없으면 이메일)이 들어간다", () => {
    const digests = buildDailyDigests(input({ fees: [fee({ id: "f1" }), fee({ id: "f2", instructorEmail: LEE })] }));
    const admin = digests.find((digest) => digest.to === ADMIN);
    expect(admin?.text).toContain("김강사 강사 · 입금 예정일");
    expect(admin?.text).toContain(`${LEE} 강사 · 입금 예정일`);
  });
});

describe("메일 내용", () => {
  it("HTML에는 모든 글자를 이스케이프해서 넣는다", () => {
    const digests = buildDailyDigests(
      input({
        courses: [course({ id: "c1", title: '<script>alert("x")</script>', client: "B&C" })],
        sessionsByCourse: { c1: [session({ id: "s1", location: "<b>3층</b>" })] },
      }),
    );
    const html = digests[0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>3층");
    expect(html).toContain("B&amp;C &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;3층&lt;/b&gt;");
  });

  it("링크는 앱 주소로 만들고, 주소가 이상하면 기본 운영 주소를 쓴다", () => {
    const withUrl = buildDailyDigests(
      input({ sessionsByCourse: { c1: [session({ id: "s1" })] }, appUrl: "https://example.org/some/path" }),
    );
    expect(withUrl[0].text).toContain("https://example.org/courses/c1");
    expect(withUrl[0].html).toContain('href="https://example.org/courses/c1"');

    const fallback = buildDailyDigests(input({ sessionsByCourse: { c1: [session({ id: "s1" })] }, appUrl: "javascript:alert(1)" }));
    expect(fallback[0].text).toContain(`${DEFAULT_APP_URL}/courses/c1`);
  });

  it("앱 주소 정리: https만 (개발용 localhost는 http도), 경로는 뗀다", () => {
    expect(resolveAppUrl(undefined)).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("  ")).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("http://example.org")).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("not a url")).toBe(DEFAULT_APP_URL);
    expect(resolveAppUrl("http://localhost:3000/admin")).toBe("http://localhost:3000");
    expect(resolveAppUrl("https://board.example.com/")).toBe("https://board.example.com");
  });

  it("제목은 있는 항목만 센다", () => {
    expect(digestSubject(0, 3)).toBe("[강의 준비 보드] 미입금 강사료 3건");
    expect(digestSubject(2, 0)).toBe("[강의 준비 보드] 내일 강의 2건");
  });

  it("escapeHtml", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("테스트 메일은 받는 사람 이름을 이스케이프해서 넣는다", () => {
    const mail = buildTestEmail({ to: ADMIN, name: "<관리자>", today: TODAY });
    expect(mail.to).toBe(ADMIN);
    expect(mail.subject).toBe("[강의 준비 보드] 테스트 메일");
    expect(mail.html).toContain("&lt;관리자&gt;님");
    expect(mail.text).toContain("<관리자>님, 알림 메일 설정이 잘 되어 있습니다.");
    expect(mail.text).toContain("2026년 10월 12일 (월)");
  });
});
