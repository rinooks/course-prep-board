// 회차 날짜·시간 표시 문구. 순수 함수.
// 저장된 날짜가 이상해도(직접 고친 데이터 등) 화면 전체가 멈추지 않게 먼저 형식을 확인한다.

import { formatDateKo, isDateString, relativeDayLabel, type DateString } from "@/lib/domain/dates";
import type { Session } from "@/lib/data/types";

const BROKEN_DATE = "날짜 확인 필요";

/** "10월 20일 (화) 09:30" — 올해가 아니면 "2027년 1월 5일 (화)"처럼 연도도 붙인다 */
export function sessionWhen(session: Pick<Session, "date" | "startTime">, today: DateString): string {
  if (!isDateString(session.date)) return BROKEN_DATE;
  const withYear = session.date.slice(0, 4) !== today.slice(0, 4);
  const date = formatDateKo(session.date, { withYear });
  return session.startTime ? `${date} ${session.startTime}` : date;
}

/** "오늘", "내일", "3일 후" — 날짜가 이상하면 빈 문자열 */
export function sessionRelativeDay(date: DateString, today: DateString): string {
  if (!isDateString(date) || !isDateString(today)) return "";
  return relativeDayLabel(date, today);
}
