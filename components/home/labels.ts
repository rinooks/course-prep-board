// 화면 문구 만들기 (순수 함수). 홈·보관함이 같이 쓴다.

import { labelForEmail } from "@/lib/data/members";
import type { Member, Session } from "@/lib/data/types";
import { formatDateKo, todayInSeoul } from "@/lib/domain/dates";

/** 담당 강사 표시. 많으면 앞의 max명만 이름을 쓰고 "외 N명"을 붙인다. */
export function instructorSummary(
  emails: readonly string[],
  members: readonly Member[],
  max = 3,
): string {
  if (emails.length === 0) return "지정 안 됨";
  const names = emails.slice(0, max).map((email) => labelForEmail(email, members));
  const rest = emails.length - names.length;
  return rest > 0 ? `${names.join(", ")} 외 ${rest}명` : names.join(", ");
}

/** "10월 15일 (목) 09:30" — 시간이 없으면 날짜만 */
export function sessionWhenLabel(session: Pick<Session, "date" | "startTime">): string {
  const date = formatDateKo(session.date);
  return session.startTime ? `${date} ${session.startTime}` : date;
}

/** 장소·대상을 " · "로 이어 붙인다. 둘 다 없으면 빈 문자열 */
export function sessionPlaceLabel(session: Pick<Session, "location" | "audience">): string {
  return [session.location, session.audience].filter((part) => part.trim().length > 0).join(" · ");
}

/** epoch 밀리초 → "2026년 10월 3일 (토)" (한국 날짜). 값이 없으면 null */
export function epochDateLabel(ms: number | null): string | null {
  if (ms === null) return null;
  return formatDateKo(todayInSeoul(new Date(ms)), { withYear: true });
}
