// 규칙 테스트에서 쓰는 사람·문서 id·길이 제한.
// 길이 제한과 첫 관리자 이메일은 앱 코드에서 가져오지 않고 요구사항(공용 계약서)의 숫자를 그대로 적었다.
// 규칙을 "앱이 지금 하는 일"이 아니라 "요구사항"과 대조하려는 것이다.

export const PROJECT_ID = "demo-edu-project";

// 사람
export const BOOTSTRAP_EMAIL = "owner@example.com";
export const ADMIN = "admin@example.com";
export const TEACHER = "teacher@example.com";
export const TEACHER2 = "teacher2@example.com";
export const STRANGER = "stranger@example.com";
export const NEWCOMER = "newcomer@example.com";

// 미리 심어 두는 문서
export const COURSE_ID = "course-active";
export const TRASHED_COURSE_ID = "course-trashed";
export const CARD_ID = "card-1";
export const SECOND_CARD_ID = "card-2";
export const TRASHED_CARD_ID = "card-trashed";
export const ITEM_ID = "item-1";
export const SECOND_ITEM_ID = "item-2";
export const SESSION_ID = "session-1";

// 공용 계약서의 길이 제한
export const LIMIT = {
  email: 254,
  displayName: 100,
  photoURL: 2048,
  courseTitle: 100,
  courseClient: 100,
  courseDescription: 2000,
  instructors: 20,
  cardTitle: 200,
  cardMemo: 5000,
  checklistText: 300,
  sessionLocation: 200,
  sessionAudience: 200,
  sessionNote: 1000,
} as const;

/** 이메일마다 고정된 가짜 uid. 대소문자가 달라도 같은 사람은 같은 uid다. */
export function uidOf(email: string): string {
  return `uid-${email.toLowerCase()}`;
}

/** 한글로 정확히 n글자. 규칙이 바이트가 아니라 글자 수로 세는지도 함께 확인된다. */
export function koreanText(length: number): string {
  return "가".repeat(length);
}
