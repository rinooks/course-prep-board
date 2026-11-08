// 팀 역할. firestore.rules의 bootstrapEmail()과 같은 값을 쓴다.

/** 첫 관리자. 이 계정은 초대 없이 처음 로그인할 때 스스로 관리자 문서를 만든다. */
export const BOOTSTRAP_ADMIN_EMAIL = "owner@example.com";

export const ROLES = ["admin", "instructor"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  admin: "관리자",
  instructor: "강사",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}
