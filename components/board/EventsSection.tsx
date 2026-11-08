"use client";

// 과정의 준비 일정 목록 (PRD F8, 가정 A9): 리허설·회의처럼 강의 말고 챙길 일정. 날짜·시작 시간 순.
// 회차 목록(SessionsSection)과 같은 모양이다: 지난 일정은 회색 상자로 물러나 보이고,
// 오늘·다가오는 일정은 남은 날을 배지로 함께 보여준다 (배지 색은 홈·캘린더와 같은 sessionDayBadge 기준).
// 여기서 넣은 일정은 팀 캘린더에도 보인다.

import { useState } from "react";
import { sessionDayBadge } from "@/components/course/dayBadge";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { tileListClass } from "@/components/ui/Bento";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { cn } from "@/components/ui/cn";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { deleteEvent } from "@/lib/data/events";
import type { CourseEvent } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { EVENT_KIND_LABELS } from "@/lib/domain/events";
import { EventFormModal } from "./EventFormModal";
import { sessionWhen } from "./sessionDisplay";

interface EventsSectionProps {
  courseId: string;
  events: readonly CourseEvent[];
  loaded: boolean;
  error: string | null;
  onRetry: () => void;
  today: DateString;
}

type FormState = { mode: "create" } | { mode: "edit"; event: CourseEvent } | null;

/** 일정을 가리키는 이름: "리허설 ‘최종 점검’" — 같은 모양 버튼이 여러 개라 어느 일정의 버튼인지 화면 낭독기에 알려 준다 */
function eventName(event: CourseEvent): string {
  return `${EVENT_KIND_LABELS[event.kind]} ‘${event.title}’`;
}

export function EventsSection({ courseId, events, loaded, error, onRetry, today }: EventsSectionProps) {
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<CourseEvent | null>(null);

  return (
    <Section
      tile
      title="준비 일정"
      meta={`${events.length}개`}
      description="리허설·회의처럼 강의 말고 챙길 일정입니다. 캘린더에도 보입니다."
      action={
        <Button variant="outline" size="sm" onClick={() => setForm({ mode: "create" })}>
          <PlusIcon />
          일정 추가
        </Button>
      }
    >
      {error ? (
        <Alert
          tone="error"
          title="준비 일정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {!loaded && !error ? <InlineLoading label="준비 일정을 불러오는 중입니다…" /> : null}

      {loaded && events.length === 0 ? (
        <EmptyState
          size="sm"
          title="등록한 준비 일정이 없습니다"
          description="리허설이나 고객사 회의 날짜를 추가하면 팀 캘린더에 함께 나옵니다."
        />
      ) : null}

      {events.length > 0 ? (
        <ul className={tileListClass}>
          {events.map((event) => {
            const past = event.date < today;
            const dayBadge = past ? null : sessionDayBadge(event.date, today);
            return (
              <li key={event.id}>
                <Card padding="sm" flat tone={past ? "surface" : "white"} className="flex h-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={past ? "neutral" : "primary"}>{EVENT_KIND_LABELS[event.kind]}</Badge>
                    <span className={cn("min-w-0 font-semibold", past ? "text-muted" : "text-ink")}>{event.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={past ? "text-muted" : "text-ink"}>{sessionWhen(event, today)}</span>
                    {past ? <Badge>지난 일정</Badge> : null}
                    {dayBadge ? <Badge tone={dayBadge.tone}>{dayBadge.text}</Badge> : null}
                  </div>
                  {event.note ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{event.note}</p>
                  ) : null}
                  <div className="mt-auto flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setForm({ mode: "edit", event })}>
                      <PencilIcon />
                      고치기
                      <span className="sr-only">({eventName(event)})</span>
                    </Button>
                    <Button variant="dangerGhost" size="sm" onClick={() => setDeleting(event)}>
                      <TrashIcon />
                      지우기
                      <span className="sr-only">({eventName(event)})</span>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {form ? (
        <EventFormModal
          key={form.mode === "edit" ? form.event.id : "new"}
          courseId={courseId}
          event={form.mode === "edit" ? form.event : null}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteEvent(courseId, deleting.id);
        }}
        title="이 일정을 지울까요?"
        description={
          deleting
            ? `${sessionWhen(deleting, today)} ${eventName(deleting)} 일정이 바로 지워지고 되살릴 수 없습니다.`
            : undefined
        }
        confirmLabel="지우기"
        tone="danger"
      />
    </Section>
  );
}
