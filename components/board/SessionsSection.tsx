"use client";

// 과정의 회차 목록: 날짜·시작 시간 순. 추가·고치기·지우기.
// 지난 회차는 회색 상자로 물러나 보이고, 오늘·다가오는 회차는 남은 날을 배지로 함께 보여준다
// (배지 색은 홈·캘린더와 같은 sessionDayBadge 기준).

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
import { deleteSession } from "@/lib/data/sessions";
import type { Session } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { SessionFormModal } from "./SessionFormModal";
import { sessionWhen } from "./sessionDisplay";

interface SessionsSectionProps {
  courseId: string;
  sessions: readonly Session[];
  loaded: boolean;
  error: string | null;
  onRetry: () => void;
  today: DateString;
}

type FormState = { mode: "create" } | { mode: "edit"; session: Session } | null;

export function SessionsSection({ courseId, sessions, loaded, error, onRetry, today }: SessionsSectionProps) {
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);

  return (
    <Section
      tile
      title="회차"
      meta={`${sessions.length}개`}
      action={
        <Button variant="outline" size="sm" onClick={() => setForm({ mode: "create" })}>
          <PlusIcon />
          회차 추가
        </Button>
      }
    >
      {error ? (
        <Alert
          tone="error"
          title="회차를 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              다시 시도
            </Button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {!loaded && !error ? <InlineLoading label="회차를 불러오는 중입니다…" /> : null}

      {loaded && sessions.length === 0 ? (
        <EmptyState
          size="sm"
          title="등록한 회차가 없습니다"
          description={
            <>
              강의 날짜·장소·대상을 회차로 추가하면 홈의 &lsquo;오늘·이번 주&rsquo;와 다음 강의 날짜에 나옵니다.
            </>
          }
        />
      ) : null}

      {sessions.length > 0 ? (
        <ul className={tileListClass}>
          {sessions.map((session) => {
            const past = session.date < today;
            const dayBadge = past ? null : sessionDayBadge(session.date, today);
            return (
              <li key={session.id}>
                <Card padding="sm" flat tone={past ? "surface" : "white"} className="flex h-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-semibold", past ? "text-muted" : "text-ink")}>
                      {sessionWhen(session, today)}
                    </span>
                    {past ? <Badge>지난 회차</Badge> : null}
                    {dayBadge ? <Badge tone={dayBadge.tone}>{dayBadge.text}</Badge> : null}
                  </div>
                  {session.location || session.audience ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      {session.location ? (
                        <>
                          <dt className="text-muted">장소</dt>
                          <dd className="text-ink">{session.location}</dd>
                        </>
                      ) : null}
                      {session.audience ? (
                        <>
                          <dt className="text-muted">대상</dt>
                          <dd className="text-ink">{session.audience}</dd>
                        </>
                      ) : null}
                    </dl>
                  ) : null}
                  {session.note ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{session.note}</p>
                  ) : null}
                  <div className="mt-auto flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setForm({ mode: "edit", session })}>
                      <PencilIcon />
                      고치기
                      <span className="sr-only">({sessionWhen(session, today)} 회차)</span>
                    </Button>
                    <Button variant="dangerGhost" size="sm" onClick={() => setDeleting(session)}>
                      <TrashIcon />
                      지우기
                      <span className="sr-only">({sessionWhen(session, today)} 회차)</span>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {form ? (
        <SessionFormModal
          key={form.mode === "edit" ? form.session.id : "new"}
          courseId={courseId}
          session={form.mode === "edit" ? form.session : null}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteSession(courseId, deleting.id);
        }}
        title="이 회차를 지울까요?"
        description={
          deleting
            ? `${sessionWhen(deleting, today)} 회차가 바로 지워지고 되살릴 수 없습니다.`
            : undefined
        }
        confirmLabel="지우기"
        tone="danger"
      />
    </Section>
  );
}
