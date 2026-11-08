import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/data/types";
import { BOOTSTRAP_ADMIN_EMAIL } from "@/lib/domain/roles";
import {
  alreadyMemberMessage,
  describeMemberAction,
  displayLabel,
  formatSeoulTimestamp,
  isAlreadyMember,
  isSelf,
  memberActivityText,
  memberInitial,
  memberLock,
  memberSubject,
  nextRole,
  roleChangeLabel,
  summarizeMembers,
  summaryText,
} from "./memberRules";

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    email: "kim@example.com",
    role: "instructor",
    displayName: "",
    photoURL: "",
    uid: null,
    invitedBy: BOOTSTRAP_ADMIN_EMAIL,
    invitedAt: null,
    lastLoginAt: null,
    ...overrides,
  };
}

// 2026-10-11(일) 15:00 한국 시간 = 06:00 UTC
const NOW = Date.UTC(2026, 9, 11, 6, 0);

describe("누구를 바꿀 수 있나", () => {
  it("첫 관리자는 대소문자와 상관없이 잠근다 (본인이 봐도 첫 관리자 안내)", () => {
    expect(memberLock(BOOTSTRAP_ADMIN_EMAIL, "lee@example.com")).toBe("bootstrap");
    expect(memberLock(BOOTSTRAP_ADMIN_EMAIL.toUpperCase(), null)).toBe("bootstrap");
    expect(memberLock(BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_EMAIL)).toBe("bootstrap");
  });

  it("자기 자신은 잠근다", () => {
    expect(memberLock("lee@example.com", "Lee@Example.com ")).toBe("self");
    expect(isSelf("lee@example.com", "LEE@example.com")).toBe(true);
  });

  it("다른 팀원은 바꿀 수 있다", () => {
    expect(memberLock("kim@example.com", "lee@example.com")).toBeNull();
    expect(memberLock("kim@example.com", null)).toBeNull();
    expect(isSelf("kim@example.com", null)).toBe(false);
  });

  it("역할 버튼은 관리자 ↔ 강사로 뒤집는다", () => {
    expect(nextRole("admin")).toBe("instructor");
    expect(nextRole("instructor")).toBe("admin");
    expect(roleChangeLabel("admin")).toBe("강사로 변경");
    expect(roleChangeLabel("instructor")).toBe("관리자로 지정");
  });
});

describe("초대 중복 확인", () => {
  it("대문자·앞뒤 공백이 있어도 같은 이메일로 본다", () => {
    const members = [makeMember({ email: "kim@example.com" })];
    expect(isAlreadyMember("  KIM@example.com ", members)).toBe(true);
    expect(isAlreadyMember("park@example.com", members)).toBe(false);
    expect(isAlreadyMember("kim@example.com", [])).toBe(false);
  });

  it("안내 문구에 이메일과 다음 할 일이 들어간다", () => {
    const message = alreadyMemberMessage("kim@example.com");
    expect(message).toContain("kim@example.com");
    expect(message).toContain("확인해 주세요");
  });
});

describe("표시 이름", () => {
  it("이름이 있으면 이름, 없으면 이메일", () => {
    expect(displayLabel(makeMember({ displayName: "김강사" }))).toBe("김강사");
    expect(displayLabel(makeMember({ displayName: "   " }))).toBe("kim@example.com");
  });

  it("문장 속 호칭은 받침으로 끝나 '을'을 붙일 수 있다", () => {
    expect(memberSubject(makeMember({ displayName: "김강사" }))).toBe("김강사님");
    expect(memberSubject(makeMember())).toBe("kim@example.com 계정");
  });

  it("첫 글자", () => {
    expect(memberInitial(makeMember({ displayName: "김강사" }))).toBe("김");
    expect(memberInitial(makeMember())).toBe("K");
  });
});

describe("시각 표시 (한국 시간)", () => {
  it("오늘·어제는 시각만 붙인다", () => {
    expect(formatSeoulTimestamp(Date.UTC(2026, 9, 11, 5, 5), NOW)).toBe("오늘 14:05");
    expect(formatSeoulTimestamp(Date.UTC(2026, 9, 10, 0, 30), NOW)).toBe("어제 09:30");
  });

  it("자정 경계를 한국 시간으로 나눈다", () => {
    // 10월 10일 15:30 UTC = 10월 11일 00:30 한국
    expect(formatSeoulTimestamp(Date.UTC(2026, 9, 10, 15, 30), NOW)).toBe("오늘 00:30");
    // 10월 10일 14:59 UTC = 10월 10일 23:59 한국
    expect(formatSeoulTimestamp(Date.UTC(2026, 9, 10, 14, 59), NOW)).toBe("어제 23:59");
  });

  it("그보다 전이면 날짜와 요일, 다른 해면 연도까지", () => {
    expect(formatSeoulTimestamp(Date.UTC(2026, 9, 9, 5, 5), NOW)).toBe("10월 9일 (금) 14:05");
    expect(formatSeoulTimestamp(Date.UTC(2025, 11, 31, 3, 0), NOW)).toBe("2025년 12월 31일 (수) 12:00");
  });

  it("팀원 활동 문구", () => {
    expect(memberActivityText(makeMember({ lastLoginAt: Date.UTC(2026, 9, 11, 5, 5) }), NOW)).toBe(
      "마지막 로그인: 오늘 14:05",
    );
    expect(memberActivityText(makeMember({ invitedAt: Date.UTC(2026, 9, 10, 0, 30) }), NOW)).toBe(
      "초대: 어제 09:30 · 아직 로그인하지 않음",
    );
    expect(memberActivityText(makeMember(), NOW)).toBe("아직 로그인하지 않음");
  });
});

describe("팀원 수 요약", () => {
  it("관리자·강사 수를 센다", () => {
    const summary = summarizeMembers([
      makeMember({ role: "admin" }),
      makeMember({ role: "instructor" }),
      makeMember({ role: "instructor" }),
    ]);
    expect(summary).toEqual({ total: 3, admins: 1, instructors: 2 });
    expect(summaryText(summary)).toBe("3명 · 관리자 1명 · 강사 2명");
  });
});

describe("확인 창 문구", () => {
  it("내보내기는 빨간 버튼", () => {
    const copy = describeMemberAction({ kind: "remove", member: makeMember({ displayName: "김강사" }) });
    expect(copy.title).toBe("김강사님을 팀에서 내보낼까요?");
    expect(copy.tone).toBe("danger");
    expect(copy.confirmLabel).toBe("내보내기");
    expect(copy.successMessage).toBe("김강사님을 팀에서 내보냈습니다.");
  });

  it("관리자 지정과 강사 변경", () => {
    const promote = describeMemberAction({ kind: "changeRole", member: makeMember(), nextRole: "admin" });
    expect(promote.title).toBe("kim@example.com 계정을 관리자로 지정할까요?");
    expect(promote.tone).toBe("default");

    const demote = describeMemberAction({
      kind: "changeRole",
      member: makeMember({ role: "admin", displayName: "이관리" }),
      nextRole: "instructor",
    });
    expect(demote.title).toBe("이관리님을 강사로 바꿀까요?");
    expect(demote.confirmLabel).toBe("강사로 변경");
    expect(demote.successMessage).toBe("이관리님을 강사로 바꿨습니다.");
  });
});
