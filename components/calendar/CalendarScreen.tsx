"use client";

// 팀 캘린더 (PRD F8, 가정 A9): 진행 중인 모든 과정의 강의 회차, 리허설·회의, 카드 마감일을 달·주 단위로 본다.
// 과정을 골라 그 과정 일정만 볼 수도 있다 (과정 보드의 "캘린더" 버튼이 ?course=과정id로 연다).
// 리허설·회의는 과정 보드의 "준비 일정"에서 넣는다.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { courseIdsKey } from "@/components/home/homeOverview";
import { useCourseList } from "@/components/home/useCourseList";
import { useCoursesDetails } from "@/components/home/useCoursesDetails";
import { useToday } from "@/components/home/useToday";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Input";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { InlineLoading, LoadingBlock } from "@/components/ui/Spinner";
import {
  formatMonthKo,
  monthStartOf,
  shiftAnchor,
  visibleRange,
  type CalendarView,
} from "@/lib/domain/calendar";
import { formatDateKo, type DateString } from "@/lib/domain/dates";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarList } from "./CalendarList";
import { buildCalendarEvents, countEvents, type CalendarEvent } from "./calendarEvents";

const VIEW_OPTIONS: readonly SegmentOption<CalendarView>[] = [
  { value: "month", label: "달" },
  { value: "week", label: "주" },
];

const NO_EVENTS: ReadonlyMap<DateString, readonly CalendarEvent[]> = new Map();

/** 고른 과정은 주소(?course=)에 둔다. 과정 보드에서 링크로 열거나 주소를 공유해도 같은 화면이 나온다. */
function calendarHref(courseId: string | null): string {
  return courseId ? `/calendar?course=${encodeURIComponent(courseId)}` : "/calendar";
}

/** useSearchParams를 쓰므로 app/calendar/page.tsx에서 Suspense로 감싼다 */
export function CalendarScreen() {
  const router = useRouter();
  const courseFilter = useSearchParams().get("course");
  const today = useToday();
  const active = useCourseList("active");
  const detailsState = useCoursesDetails(courseIdsKey(active.courses ?? []));

  const [view, setView] = useState<CalendarView>("month");
  /** 보고 있는 날짜. null이면 오늘 */
  const [anchor, setAnchor] = useState<DateString | null>(null);

  const current = anchor ?? today;
  const courses = active.courses;
  // 고른 과정이 보관·삭제되어 목록에 없으면 전체를 보여 준다
  const filterCourse = courses?.find((course) => course.id === courseFilter) ?? null;
  const range = current ? visibleRange(view, current) : null;
  const monthKey = current ? current.slice(0, 7) : "";

  // 과정이 많아야 10개 안팎이고 범위도 6주 이내라 매번 계산해도 가볍다
  const events =
    courses && range
      ? buildCalendarEvents(courses, detailsState.details, range, { courseId: filterCourse?.id ?? null })
      : NO_EVENTS;

  // 달 보기의 숫자는 그 달 것만 센다 (달력 앞뒤로 붙은 다른 달 날짜는 빼고)
  const counts =
    view === "week"
      ? countEvents(events)
      : countEvents(new Map([...events].filter(([date]) => date.slice(0, 7) === monthKey)));

  function changeView(next: CalendarView) {
    if (next === view || !current || !today) return;
    // 이번 달을 보다가 주 보기로 바꾸면 이번 주를, 다른 달이면 그 달 첫 주를 보여 준다
    if (next === "week" && monthStartOf(current) === monthStartOf(today)) setAnchor(null);
    setView(next);
  }

  function showWeekOf(date: DateString) {
    setAnchor(date);
    setView("week");
  }

  const unit = view === "month" ? "달" : "주";
  const title = !current
    ? "팀 캘린더"
    : view === "month"
      ? formatMonthKo(current)
      : `${formatDateKo(range!.start)} ~ ${formatDateKo(range!.end)}`;
  const summary = courses
    ? `강의 ${counts.sessions}회 · 리허설·회의 ${counts.events}개 · 마감 카드 ${counts.dues}장${filterCourse ? ` · ${filterCourse.title}만 보는 중` : ""}`
    : "일정을 불러오는 중입니다";

  return (
    <>
      <PageHeader
        eyebrow="팀 캘린더"
        title={title}
        description={summary}
        actions={
          current ? (
            <>
              <Button
                variant="inverseOutline"
                size="sm"
                aria-label={`이전 ${unit}`}
                onClick={() => setAnchor(shiftAnchor(view, current, -1))}
              >
                <ChevronLeftIcon />
                이전
              </Button>
              <Button variant="inverseOutline" size="sm" onClick={() => setAnchor(null)}>
                오늘
              </Button>
              <Button
                variant="inverseOutline"
                size="sm"
                aria-label={`다음 ${unit}`}
                onClick={() => setAnchor(shiftAnchor(view, current, 1))}
              >
                다음
                <ChevronRightIcon />
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <SegmentedControl tone="inverse" label="보기" options={VIEW_OPTIONS} value={view} onChange={changeView} />
          {courses && courses.length > 0 ? (
            <label className="flex flex-col gap-1 text-sm font-semibold text-primary-foreground/80">
              과정
              <Select
                value={filterCourse?.id ?? ""}
                onChange={(event) => router.replace(calendarHref(event.target.value || null), { scroll: false })}
                className="w-auto min-w-56 max-w-full"
              >
                <option value="">모든 과정</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
      </PageHeader>

      <PageBody>
        {/* 이전·다음을 누르면 바뀐 기간을 화면 낭독기에 알려 준다 */}
        <p className="sr-only" aria-live="polite">
          {title}, {summary}
        </p>
        <CalendarBody
          today={today}
          current={current}
          view={view}
          monthKey={monthKey}
          range={range}
          events={events}
          coursesLoaded={courses !== null}
          courseCount={courses?.length ?? 0}
          coursesError={active.error}
          onRetryCourses={active.retry}
          detailsLoading={Boolean(courses?.some((course) => !detailsState.details[course.id]?.loaded))}
          detailsError={detailsState.error}
          onRetryDetails={detailsState.retry}
          onShowWeek={showWeekOf}
        />
      </PageBody>
    </>
  );
}

interface CalendarBodyProps {
  today: DateString | null;
  current: DateString | null;
  view: CalendarView;
  monthKey: string;
  range: ReturnType<typeof visibleRange> | null;
  events: ReadonlyMap<DateString, readonly CalendarEvent[]>;
  coursesLoaded: boolean;
  courseCount: number;
  coursesError: string | null;
  onRetryCourses: () => void;
  detailsLoading: boolean;
  detailsError: string | null;
  onRetryDetails: () => void;
  onShowWeek: (date: DateString) => void;
}

function CalendarBody({
  today,
  current,
  view,
  monthKey,
  range,
  events,
  coursesLoaded,
  courseCount,
  coursesError,
  onRetryCourses,
  detailsLoading,
  detailsError,
  onRetryDetails,
  onShowWeek,
}: CalendarBodyProps) {
  if (coursesError) {
    return (
      <Alert
        tone="error"
        title="과정 목록을 불러오지 못했습니다"
        action={
          <Button variant="outline" size="sm" onClick={onRetryCourses}>
            다시 시도
          </Button>
        }
      >
        {coursesError}
      </Alert>
    );
  }

  if (!coursesLoaded || !today || !current || !range) {
    return <LoadingBlock label="일정을 불러오는 중입니다…" />;
  }

  if (courseCount === 0) {
    return (
      <EmptyState
        title="진행 중인 과정이 없습니다"
        description="과정을 만들고 회차 날짜, 리허설·회의, 카드 마감일을 넣으면 캘린더에 나타납니다."
        action={<ButtonLink href="/courses/new">새 과정 만들기</ButtonLink>}
      />
    );
  }

  return (
    <>
      {detailsError ? (
        <Alert
          tone="error"
          title="일정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetryDetails}>
              다시 시도
            </Button>
          }
        >
          {detailsError}
        </Alert>
      ) : null}

      {/* 색 설명과 달력은 한 구역이라 PageBody의 gap-4로 떼지 않고 한 묶음으로 둔다 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <Legend />
          {detailsLoading && !detailsError ? <InlineLoading label="일정을 불러오는 중입니다…" /> : null}
        </div>

        <div className="hidden md:block">
          <CalendarGrid
            view={view}
            range={range}
            monthKey={monthKey}
            today={today}
            events={events}
            onShowWeek={onShowWeek}
          />
        </div>
        <div className="md:hidden">
          <CalendarList view={view} range={range} monthKey={monthKey} today={today} events={events} />
        </div>
      </div>
    </>
  );
}

/** 색 설명: 강의(과정마다 다른 색), 리허설·회의와 마감 카드(흰 바탕, 앞 글자로 구분), 지난 마감(빨강) */
function Legend() {
  return (
    <ul aria-label="일정 표시 설명" className="flex flex-wrap items-center gap-3">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-primary" />
        강의 (과정마다 색이 다릅니다)
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-line bg-white" />
        리허설·회의
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-line bg-white" />
        마감 카드
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-danger/25 bg-white" />
        <span className="text-danger">지난 마감</span>
      </li>
    </ul>
  );
}
