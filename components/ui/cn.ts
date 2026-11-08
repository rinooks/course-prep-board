/** 조건부 className 합치기. false·null·undefined·빈 문자열은 건너뛴다. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** 모든 버튼·링크에 붙이는 포커스 링 (design.md 7장) */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** 네이비 타일(bg-primary) 위의 버튼·링크용 포커스 링. 네이비 링은 배경에 묻히므로 흰 링을 쓴다 */
export const focusRingInverse =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary";
