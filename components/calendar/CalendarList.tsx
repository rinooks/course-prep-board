// 휴대폰(md 미만)의 캘린더: 날짜별 목록.
// 달 보기는 일정이 있는 날만, 주 보기는 7일을 모두 보여 준다(빈 날은 "일정 없음").

import { sessionDayBadge } from "@/components/course/dayBadge";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { datesInRange, type CalendarView } from "@/lib/domain/calendar";
import { daysBetween, formatDateKo, relativeDayLabel, type DateRange, type DateString } from "@/lib/domain/dates";
import { eventKey, type CalendarEvent } from "./calendarEvents";
import { EventLink } from "./EventLink";

interface CalendarListProps {
  view: CalendarView;
  range: DateRange;
  /** 달 보기에서는 이 달(YYYY-MM) 날짜만 보여 준다 (달력 앞뒤로 붙은 다른 달 날짜는 뺀다) */
  monthKey: string;
  today: DateString;
  events: ReadonlyMap<DateString, readonly CalendarEvent[]>;
}

export function CalendarList({ view, range, monthKey, today, events }: CalendarListProps) {
  const dates = datesInRange(range).filter((date) =>
    view === "month" ? date.slice(0, 7) === monthKey && events.has(date) : true,
  );

  if (dates.length === 0) {
    return (
      <EmptyState
        size="sm"
        title="이 달에는 일정이 없습니다"
        description="회차 날짜, 리허설·회의, 카드 마감일을 넣으면 여기에 보입니다."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {dates.map((date) => {
        const dayEvents = events.get(date) ?? [];
        // 어제·오늘·내일만 "오늘" 같은 표시를 붙인다. 오늘만 주의 색(홈 "오늘·이번 주"와 같은 색)
        const near = Math.abs(daysBetween(today, date)) <= 1;
        return (
          <li key={date} className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              {formatDateKo(date)}
              {near ? (
                <Badge tone={sessionDayBadge(date, today)?.tone ?? "neutral"}>{relativeDayLabel(date, today)}</Badge>
              ) : null}
            </p>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted">일정 없음</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {dayEvents.map((event) => (
                  <li key={eventKey(event)}>
                    <EventLink event={event} today={today} size="full" />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
