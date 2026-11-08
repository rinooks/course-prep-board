import Link from "next/link";
import { courseColor } from "@/components/course/courseColor";
import { cn, focusRing } from "@/components/ui/cn";
import { formatDateKo, type DateString } from "@/lib/domain/dates";
import { EVENT_KIND_LABELS } from "@/lib/domain/events";
import { stageLabel } from "@/lib/domain/stages";
import { eventHref, type CalendarEvent } from "./calendarEvents";

interface EventLinkProps {
  event: CalendarEvent;
  today: DateString;
  /** compact: 달력 칸 안(한 줄, 과정 이름 생략) / full: 주 보기·목록(과정 이름까지) */
  size: "compact" | "full";
}

/** 일정 메모는 길 수 있어 첫 줄만, 이 글자 수까지만 보여 준다 */
const NOTE_PREVIEW_LENGTH = 40;

function notePreview(note: string): string {
  const firstLine = note.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  return firstLine.length > NOTE_PREVIEW_LENGTH ? `${firstLine.slice(0, NOTE_PREVIEW_LENGTH)}…` : firstLine;
}

function detailText(event: CalendarEvent): string {
  if (event.kind === "session") {
    return [event.location, event.audience].filter((part) => part.trim().length > 0).join(" · ") || "강의";
  }
  if (event.kind === "event") {
    return [event.courseTitle, notePreview(event.note)].filter((part) => part.length > 0).join(" · ");
  }
  return `${event.courseTitle} · ${stageLabel(event.stage)}`;
}

/** 일정의 이름 (달력 칸에서 마우스를 올렸을 때 보여 줄 글자) */
function mainText(event: CalendarEvent): string {
  if (event.kind === "session") return event.courseTitle;
  if (event.kind === "event") return `${EVENT_KIND_LABELS[event.eventKind]} ${event.title}`;
  return event.cardTitle;
}

/** 화면 낭독기가 앞에 읽어 줄 종류 이름 */
function kindText(event: CalendarEvent, overdue: boolean): string {
  if (event.kind === "session") return "강의";
  if (event.kind === "event") return EVENT_KIND_LABELS[event.eventKind];
  return overdue ? "마감 지남" : "마감 카드";
}

/**
 * 일정 하나. 강의는 과정 색 바탕, 리허설·회의와 마감 카드는 흰 바탕 테두리 + 왼쪽 과정 색 선으로 구분한다
 * (지난 마감은 빨강). 리허설·회의는 앞에 "리허설"/"회의", 마감 카드는 "마감"을 붙여 서로 구분한다.
 * 색만으로 과정을 가리지 않도록 글자(과정 이름·일정 이름·카드 이름)는 그대로 둔다.
 * 화면 낭독기에는 날짜·종류를 앞에 붙여 읽어 준다 (숨은 글자).
 */
export function EventLink({ event, today, size }: EventLinkProps) {
  const overdue = event.kind === "due" && event.date < today;
  const compact = size === "compact";
  const detail = detailText(event);
  const color = courseColor(event.courseId);

  return (
    <Link
      href={eventHref(event)}
      // 달력 칸에서는 글자가 잘리므로 마우스를 올리면 전체를 보여 준다
      title={compact ? `${mainText(event)} — ${detail}` : undefined}
      className={cn(
        // relative: 숨은 글자(sr-only)가 칸 밖으로 빠져나가 가로 스크롤을 만들지 않게
        "relative flex flex-col rounded-button border text-left transition motion-reduce:transition-none",
        compact ? "min-h-8 justify-center px-2 py-1 text-xs" : "min-h-11 justify-center gap-0.5 px-3 py-2 text-sm",
        event.kind === "session"
          ? cn(color.bg, "border-transparent text-primary-foreground hover:underline")
          : cn(
              // 왼쪽 선만 과정 색 (border-l-*가 border 색·굵기보다 뒤에 적용된다)
              "border-l-4 bg-white",
              color.borderLeft,
              overdue ? "border-danger/25 text-danger hover:bg-danger/5" : "border-line text-ink hover:bg-ink/5",
            ),
        focusRing,
      )}
    >
      <span className="sr-only">
        {formatDateKo(event.date)} {kindText(event, overdue)},{" "}
      </span>
      <span className={cn("font-semibold", compact && "truncate")}>
        <MainLine event={event} />
      </span>
      {compact ? (
        <span className="sr-only">, {detail}</span>
      ) : (
        <span
          className={cn(
            "text-xs",
            // 과정 색 위 흰 글자를 /80으로 옅게 하면 일부 색(course-3·5)에서 명암비 4.5:1 아래로 떨어져 그대로 둔다
            event.kind === "session" ? "text-primary-foreground" : overdue ? "text-danger" : "text-muted",
          )}
        >
          {detail}
        </span>
      )}
    </Link>
  );
}

/** 첫 줄: 강의는 "시간 과정 이름", 리허설·회의는 "종류 시간 일정 이름", 마감 카드는 "마감 카드 이름" */
function MainLine({ event }: { event: CalendarEvent }) {
  if (event.kind === "session") {
    return (
      <>
        {event.startTime ? <span className="mr-1 tabular-nums">{event.startTime}</span> : null}
        {event.courseTitle}
      </>
    );
  }
  if (event.kind === "event") {
    return (
      <>
        {/* 종류는 숨은 글자로 이미 읽어 주므로 화면 낭독기에는 두 번 읽히지 않게 숨긴다 */}
        <span aria-hidden="true" className="mr-1">
          {EVENT_KIND_LABELS[event.eventKind]}
        </span>
        {event.startTime ? <span className="mr-1 tabular-nums">{event.startTime}</span> : null}
        {event.title}
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="mr-1">
        마감
      </span>
      {event.cardTitle}
    </>
  );
}
