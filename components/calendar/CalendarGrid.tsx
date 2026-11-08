// 넓은 화면(md 이상)의 달력 칸. 달 보기는 4~6주, 주 보기는 한 줄이다.
// 휴대폰은 칸이 너무 좁아 CalendarList(날짜별 목록)로 대신 보여 준다.

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { chunkWeeks, datesInRange, type CalendarView } from "@/lib/domain/calendar";
import { formatDateKo, type DateRange, type DateString } from "@/lib/domain/dates";
import { eventKey, type CalendarEvent } from "./calendarEvents";
import { EventLink } from "./EventLink";

/** 달 보기에서 한 칸에 보여 줄 일정 수. 넘으면 "N개 더"를 눌러 그 주를 펼쳐 본다 */
const MONTH_CELL_LIMIT = 3;

const WEEKDAY_HEADERS = ["월", "화", "수", "목", "금", "토", "일"] as const;

interface CalendarGridProps {
  view: CalendarView;
  range: DateRange;
  /** 달 보기에서 이 달(YYYY-MM)이 아닌 날짜는 옅게 그린다 */
  monthKey: string;
  today: DateString;
  events: ReadonlyMap<DateString, readonly CalendarEvent[]>;
  /** "N개 더"를 누르면 그날이 든 주 보기로 바꾼다 */
  onShowWeek: (date: DateString) => void;
}

export function CalendarGrid({ view, range, monthKey, today, events, onShowWeek }: CalendarGridProps) {
  const weeks = chunkWeeks(datesInRange(range));

  return (
    <Card padding="none" className="overflow-hidden">
      <div aria-hidden="true" className="grid grid-cols-7 border-b border-line bg-surface">
        {WEEKDAY_HEADERS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "px-3 py-2 text-sm font-semibold",
              index === 5 ? "text-primary" : index === 6 ? "text-danger" : "text-muted",
            )}
          >
            {label}
          </div>
        ))}
      </div>
      <ol className="flex flex-col">
        {weeks.map((week) => (
          <li key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
            {week.map((date) => (
              <DayCell
                key={date}
                date={date}
                today={today}
                outside={view === "month" && date.slice(0, 7) !== monthKey}
                tall={view === "week"}
                limit={view === "month" ? MONTH_CELL_LIMIT : Number.POSITIVE_INFINITY}
                events={events.get(date) ?? []}
                onShowWeek={onShowWeek}
              />
            ))}
          </li>
        ))}
      </ol>
    </Card>
  );
}

interface DayCellProps {
  date: DateString;
  today: DateString;
  outside: boolean;
  tall: boolean;
  limit: number;
  events: readonly CalendarEvent[];
  onShowWeek: (date: DateString) => void;
}

function DayCell({ date, today, outside, tall, limit, events, onShowWeek }: DayCellProps) {
  const isToday = date === today;
  const visible = events.slice(0, limit);
  const hidden = events.length - visible.length;
  const day = Number(date.slice(8, 10));

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1.5 border-r border-line p-2 last:border-r-0",
        tall ? "min-h-64" : "min-h-32",
        outside && "bg-surface",
      )}
    >
      <p className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
            isToday ? "bg-primary text-primary-foreground" : outside ? "text-muted" : "text-ink",
          )}
        >
          <span aria-hidden="true">{day}</span>
          <span className="sr-only">{formatDateKo(date)}</span>
        </span>
        {isToday ? <span className="text-xs font-semibold text-primary">오늘</span> : null}
      </p>
      {visible.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {visible.map((event) => (
            <li key={eventKey(event)}>
              <EventLink event={event} today={today} size={tall ? "full" : "compact"} />
            </li>
          ))}
        </ul>
      ) : null}
      {hidden > 0 ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => onShowWeek(date)}>
          {/* md 폭의 칸(약 86px)에는 "N개 더 보기"가 다 안 들어가 넘치므로, 넓은 화면에서만 "보기"를 붙인다 */}
          <span>
            {hidden}개 더<span className="hidden lg:inline"> 보기</span>
          </span>
          <span className="sr-only"> ({formatDateKo(date)}이 든 주 보기로 바꿉니다)</span>
        </Button>
      ) : null}
    </div>
  );
}
