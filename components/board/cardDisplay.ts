// 카드에 붙는 작은 표시(마감일 배지 등)의 문구와 색을 정한다. 순수 함수.

import { daysBetween, dueStatus, formatDateKo, isDateString, type DateString } from "@/lib/domain/dates";
import type { BadgeTone } from "@/components/ui/Badge";

export interface DueDisplay {
  tone: BadgeTone;
  /** 배지에 보이는 짧은 글 */
  text: string;
  /** 화면 낭독기용 전체 문장 */
  description: string;
}

/**
 * 마감일 배지.
 * - 끝난 카드: 날짜만 회색으로 (지났어도 강조하지 않는다)
 * - 지남: 빨강 "마감 2일 지남"
 * - 오늘·3일 이내: 노랑 "오늘 마감", "내일 마감", "3일 후 마감"
 * - 그 뒤: 회색 "10월 20일 (화) 마감"
 */
export function describeDue(
  dueDate: DateString | null,
  today: DateString,
  done: boolean,
): DueDisplay | null {
  if (!dueDate || !isDateString(dueDate) || !isDateString(today)) return null;

  const dateText = formatDateKo(dueDate);
  if (done) {
    return { tone: "neutral", text: `${dateText} 마감`, description: `마감일 ${dateText}, 끝난 카드` };
  }

  const diff = daysBetween(today, dueDate);
  switch (dueStatus(dueDate, today)) {
    case "overdue":
      return {
        tone: "danger",
        text: `마감 ${-diff}일 지남`,
        description: `마감일 ${dateText}, ${-diff}일 지났습니다`,
      };
    case "today":
      return { tone: "warning", text: "오늘 마감", description: `마감일 ${dateText}, 오늘입니다` };
    case "soon": {
      const text = diff === 1 ? "내일 마감" : `${diff}일 후 마감`;
      return { tone: "warning", text, description: `마감일 ${dateText}, ${text}` };
    }
    default:
      return { tone: "neutral", text: `${dateText} 마감`, description: `마감일 ${dateText}` };
  }
}
