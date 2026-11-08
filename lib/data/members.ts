// 팀원(members) 읽기·쓰기. 초대·내보내기·역할 변경은 관리자만 (firestore.rules가 막는다).

import { deleteDoc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { AppError } from "@/lib/domain/errors";
import { READ_TIMEOUT_MS, withTimeout } from "@/lib/domain/async";
import { BOOTSTRAP_ADMIN_EMAIL, isBootstrapAdmin, type Role } from "@/lib/domain/roles";
import { LIMITS, normalizeEmail, validateInviteEmail, validateRole } from "@/lib/domain/validation";
import { memberDoc, membersCol } from "./refs";
import { toMember } from "./convert";
import { listenDoc, listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type { ErrorHandler, Member, Unsubscribe } from "./types";

/** 팀원 전체 (관리자 먼저, 그다음 이메일 순) */
export function subscribeMembers(
  onData: (members: Member[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => membersCol(),
    toMember,
    (members) => {
      onData(
        [...members].sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.email < b.email ? -1 : 1;
        }),
      );
    },
    onError,
  );
}

/** 내 팀원 문서 구독. 초대받지 않았으면 onData(null). 초대 여부 확인에 쓴다. */
export function subscribeOwnMember(
  email: string,
  onData: (member: Member | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenDoc(() => memberDoc(normalizeEmail(email)), toMember, onData, onError);
}

/** 강사 초대 (관리자). 이미 팀원이면 AppError("already-member") */
export async function inviteMember(rawEmail: string, role: Role = "instructor"): Promise<void> {
  const emailCheck = validateInviteEmail(rawEmail);
  if (!emailCheck.ok) throwValidation(emailCheck.errors);
  const roleCheck = validateRole(role);
  if (!roleCheck.ok) throwValidation(roleCheck.errors);

  const email = emailCheck.value;
  const actor = requireActorEmail();
  const ref = memberDoc(email);

  const existing = await withTimeout(getDoc(ref), READ_TIMEOUT_MS);
  if (existing.exists()) {
    throw new AppError("already-member", `이미 팀원인 이메일입니다(${email}). 팀원 목록에서 확인해 주세요.`);
  }

  // 중복 방지 key를 쓰지 않는다. key는 "한 번 성공한 작업"을 기억해 두므로,
  // 같은 화면에서 내보낸 사람을 다시 초대하면 저장 없이 성공만 돌려주게 된다.
  // 두 번 눌러도 안전한 이유: 문서가 이미 있으면 보안 규칙이 두 번째 쓰기(수정)를 거부한다.
  await runWrite(() =>
    setDoc(ref, {
      email,
      role: roleCheck.value,
      displayName: "",
      photoURL: "",
      uid: null,
      invitedBy: actor,
      invitedAt: serverTimestamp(),
      lastLoginAt: null,
    }),
  );
}

function assertNotSelfOrBootstrap(email: string, action: string) {
  const actor = requireActorEmail();
  if (email === actor) {
    throw new AppError("self-change", `자기 자신은 ${action} 수 없습니다. 다른 관리자에게 부탁해 주세요.`);
  }
  if (isBootstrapAdmin(email)) {
    throw new AppError(
      "bootstrap-admin",
      `처음 만든 관리자 계정(${BOOTSTRAP_ADMIN_EMAIL})은 ${action} 수 없습니다.`,
    );
  }
}

/** 팀에서 내보내기 (관리자). 자기 자신과 첫 관리자는 내보낼 수 없다. */
export async function removeMember(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  assertNotSelfOrBootstrap(email, "내보낼");
  await runWrite(() => deleteDoc(memberDoc(email)));
}

/** 역할 바꾸기 (관리자). 자기 자신과 첫 관리자의 역할은 바꿀 수 없다. */
export async function changeMemberRole(rawEmail: string, role: Role): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const roleCheck = validateRole(role);
  if (!roleCheck.ok) throwValidation(roleCheck.errors);
  assertNotSelfOrBootstrap(email, "역할을 바꿀");
  await runWrite(() => updateDoc(memberDoc(email), { role: roleCheck.value }));
}

function profileFields(user: User) {
  return {
    uid: user.uid,
    displayName: (user.displayName ?? "").slice(0, LIMITS.displayName),
    photoURL: (user.photoURL ?? "").slice(0, LIMITS.photoURL),
    lastLoginAt: serverTimestamp(),
  };
}

/** 로그인할 때 내 문서에 구글 프로필(이름·사진·uid)과 마지막 로그인 시각을 적는다. */
export async function linkMemberProfile(user: User): Promise<void> {
  if (!user.email) return;
  const email = normalizeEmail(user.email);
  await runWrite(() => updateDoc(memberDoc(email), profileFields(user)));
}

/** 첫 관리자 계정이 처음 로그인할 때 자기 관리자 문서를 만든다. */
export async function createBootstrapAdmin(user: User): Promise<void> {
  const email = normalizeEmail(user.email ?? "");
  if (!isBootstrapAdmin(email)) {
    throw new AppError("not-bootstrap", "초대받지 않은 계정입니다. 관리자에게 초대를 요청해 주세요.");
  }
  await runWrite(
    () =>
      setDoc(memberDoc(email), {
        email,
        role: "admin",
        invitedBy: email,
        invitedAt: serverTimestamp(),
        ...profileFields(user),
      }),
    `member:bootstrap:${email}`,
  );
}

/** 화면 표시용 이름: 이름이 있으면 이름, 없으면 이메일 */
export function memberLabel(member: Pick<Member, "displayName" | "email"> | null | undefined): string {
  if (!member) return "";
  return member.displayName.trim().length > 0 ? member.displayName : member.email;
}

/** 이메일 → 화면 표시용 이름. 팀원 목록에 없으면 이메일 그대로 */
export function labelForEmail(email: string | null | undefined, members: readonly Member[]): string {
  if (!email) return "";
  const member = members.find((item) => item.email === email);
  return member ? memberLabel(member) : email;
}
