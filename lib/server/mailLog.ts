// mailLog/{날짜}_{이메일 해시}: "오늘 이 사람에게 메일을 보냈다"는 표시 (순수 함수, 단위 테스트 대상).
// 크론이 두 번 불려도 같은 문서를 만들 수 없으므로(create) 같은 메일이 두 번 가지 않는다.
// 문서 id와 내용에 이메일 원문을 넣지 않는다 (해시 앞 16자리만).

import { createHash } from "node:crypto";
import { addDays, type DateString } from "@/lib/domain/dates";

/** firestore.rules에서 브라우저 접근을 모두 막아 둔 서버 전용 컬렉션 */
export const MAIL_LOG_COLLECTION = "mailLog";

/** 이 날수보다 오래된 기록은 지운다 */
export const MAIL_LOG_KEEP_DAYS = 30;

/** 소문자 이메일의 SHA-256 앞 16자리 (16진수) */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex").slice(0, 16);
}

export function mailLogId(date: DateString, email: string): string {
  return `${date}_${emailHash(email)}`;
}

/** 이 날짜보다 앞선(date < 반환값) 기록을 지운다 */
export function mailLogCutoff(today: DateString): DateString {
  return addDays(today, -MAIL_LOG_KEEP_DAYS);
}
