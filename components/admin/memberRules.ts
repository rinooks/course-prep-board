// 팀 관리 화면의 규칙과 문구. React·Firebase 없이 계산만 한다 (memberRules.test.ts가 검사한다).
// 실제 보호는 firestore.rules와 lib/data/members.ts가 하고, 여기는 화면에서 미리 막고 안내하는 용도다.

import type { Member, Role } from "@/lib/data/types";
import { addDays, formatDateKo, todayInSeoul } from "@/lib/domain/dates";
import { isBootstrapAdmin, roleLabel } from "@/lib/domain/roles";
import { normalizeEmail } from "@/lib/domain/validation";

/** 한국은 서머타임이 없어 항상 UTC+9다 */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

// ---------- 누가 누구를 바꿀 수 있나 ----------

/** 화면에서 역할 변경·내보내기를 막아야 하는 이유. 막을 이유가 없으면 null */
export type MemberLock = "bootstrap" | "self" | null;

export function memberLock(memberEmail: string, actorEmail: string | null): MemberLock {
  const email = normalizeEmail(memberEmail);
  // 첫 관리자는 본인이 보더라도 "영구히 고정"이라는 안내가 더 정확하다
  if (isBootstrapAdmin(email)) return "bootstrap";
  if (actorEmail && email === normalizeEmail(actorEmail)) return "self";
  return null;
}

export function lockReason(lock: Exclude<MemberLock, null>): string {
  if (lock === "bootstrap") {
    return "처음 만든 관리자 계정이라 역할을 바꾸거나 내보낼 수 없습니다.";
  }
  return "내 계정은 바꾸거나 내보낼 수 없습니다. 필요하면 다른 관리자에게 부탁하세요.";
}

export function isSelf(memberEmail: string, actorEmail: string | null): boolean {
  return actorEmail !== null && normalizeEmail(memberEmail) === normalizeEmail(actorEmail);
}

/** 역할 버튼을 누르면 바뀔 역할 (관리자 ↔ 강사) */
export function nextRole(role: Role): Role {
  return role === "admin" ? "instructor" : "admin";
}

/** 역할 버튼 글자 */
export function roleChangeLabel(currentRole: Role): string {
  return currentRole === "admin" ? "강사로 변경" : "관리자로 지정";
}

// ---------- 초대 ----------

export function isAlreadyMember(rawEmail: string, members: readonly Pick<Member, "email">[]): boolean {
  const email = normalizeEmail(rawEmail);
  return members.some((member) => member.email === email);
}

export function alreadyMemberMessage(email: string): string {
  return `이미 팀원인 이메일입니다(${email}). 아래 팀원 목록에서 확인해 주세요.`;
}

// ---------- 표시 문구 ----------

/** 화면 표시 이름: 이름이 있으면 이름, 없으면 이메일 */
export function displayLabel(member: Pick<Member, "displayName" | "email">): string {
  const name = member.displayName.trim();
  return name.length > 0 ? name : member.email;
}

/**
 * 문장 안에서 부르는 말. 뒤에 조사 "을"을 붙여 쓴다.
 * 이름이 있으면 "홍길동님", 없으면 "a@b.com 계정" — 둘 다 받침으로 끝나 "을"이 맞다.
 */
export function memberSubject(member: Pick<Member, "displayName" | "email">): string {
  const name = member.displayName.trim();
  return name.length > 0 ? `${name}님` : `${member.email} 계정`;
}

/** 동그라미 안에 넣을 첫 글자 */
export function memberInitial(member: Pick<Member, "displayName" | "email">): string {
  const source = displayLabel(member);
  const first = Array.from(source)[0] ?? "?";
  return first.toUpperCase();
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 밀리초 시각 → 한국 시간 "14:05" */
function seoulClock(ms: number): string {
  const shifted = new Date(ms + SEOUL_OFFSET_MS);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}

/**
 * 시각을 한국 시간으로 읽기 쉽게 쓴다.
 * "오늘 14:05" / "어제 09:30" / "10월 9일 (금) 14:05" / 다른 해면 "2025년 10월 9일 (목) 14:05"
 */
export function formatSeoulTimestamp(ms: number, nowMs: number): string {
  const date = todayInSeoul(new Date(ms));
  const today = todayInSeoul(new Date(nowMs));
  const clock = seoulClock(ms);
  if (date === today) return `오늘 ${clock}`;
  if (date === addDays(today, -1)) return `어제 ${clock}`;
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return `${formatDateKo(date, { withYear: !sameYear })} ${clock}`;
}

/** 팀원 줄 아래에 붙는 활동 문구 */
export function memberActivityText(
  member: Pick<Member, "lastLoginAt" | "invitedAt">,
  nowMs: number,
): string {
  if (member.lastLoginAt !== null) {
    return `마지막 로그인: ${formatSeoulTimestamp(member.lastLoginAt, nowMs)}`;
  }
  if (member.invitedAt !== null) {
    return `초대: ${formatSeoulTimestamp(member.invitedAt, nowMs)} · 아직 로그인하지 않음`;
  }
  return "아직 로그인하지 않음";
}

export interface MemberSummary {
  total: number;
  admins: number;
  instructors: number;
}

export function summarizeMembers(members: readonly Pick<Member, "role">[]): MemberSummary {
  const admins = members.filter((member) => member.role === "admin").length;
  return { total: members.length, admins, instructors: members.length - admins };
}

export function summaryText(summary: MemberSummary): string {
  return `${summary.total}명 · 관리자 ${summary.admins}명 · 강사 ${summary.instructors}명`;
}

// ---------- 확인 창 ----------

export type MemberAction =
  | { kind: "changeRole"; member: Member; nextRole: Role }
  | { kind: "remove"; member: Member };

export interface MemberActionCopy {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "default" | "danger";
  /** 성공했을 때 알림 문구 */
  successMessage: string;
}

/** 확인 창에 들어갈 제목·설명·버튼 글자 */
export function describeMemberAction(action: MemberAction): MemberActionCopy {
  const subject = memberSubject(action.member);

  if (action.kind === "remove") {
    return {
      title: `${subject}을 팀에서 내보낼까요?`,
      description:
        "내보내면 이 계정은 바로 앱에 들어올 수 없습니다. 이 사람이 만든 과정과 카드는 그대로 남고, 나중에 다시 초대하면 다시 들어올 수 있습니다.",
      confirmLabel: "내보내기",
      tone: "danger",
      successMessage: `${subject}을 팀에서 내보냈습니다.`,
    };
  }

  if (action.nextRole === "admin") {
    return {
      title: `${subject}을 관리자로 지정할까요?`,
      description:
        "관리자는 강사 초대·내보내기, 역할 변경, 과정 삭제와 되살리기를 할 수 있습니다. 믿을 수 있는 사람만 지정하세요.",
      confirmLabel: "관리자로 지정",
      tone: "default",
      successMessage: `${subject}을 관리자로 지정했습니다.`,
    };
  }

  return {
    title: `${subject}을 ${roleLabel(action.nextRole)}로 바꿀까요?`,
    description:
      "팀 관리와 과정 삭제 권한이 사라집니다. 과정을 보고 고치는 일은 그대로 할 수 있습니다.",
    confirmLabel: "강사로 변경",
    tone: "default",
    successMessage: `${subject}을 ${roleLabel(action.nextRole)}로 바꿨습니다.`,
  };
}
