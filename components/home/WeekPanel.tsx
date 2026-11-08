"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RowLink } from "@/components/ui/Row";
import { Section, SectionHeading } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { sessionDayBadge } from "@/components/course/dayBadge";
import { labelForEmail } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { dueStatus, formatDateKo, relativeDayLabel, type DateString } from "@/lib/domain/dates";
import { stageLabel } from "@/lib/domain/stages";
import type { AgendaCard, AgendaDay, HomeAgenda, HomeScope } from "./homeOverview";
import { sessionPlaceLabel } from "./labels";
import { HOME_SECTION_IDS } from "./StatTiles";

/** 처음에 보여줄 마감 카드 수. 나머지는 "더 보기"로 편다 */
const DUE_PREVIEW_COUNT = 8;

interface WeekPanelProps {
  agenda: HomeAgenda;
  today: DateString;
  members: readonly Member[];
  /** 내 것만: 문구를 "내 강의", "나에게 맡긴 카드"로 바꾼다 (목록은 이미 걸러져 온다) */
  scope: HomeScope;
  /** 아직 일부 과정의 일정을 받는 중이면 true */
  loading: boolean;
}

/** 홈의 "오늘·이번 주": 7일 안의 강의와 마감이 다가온 카드 */
export function WeekPanel({ agenda, today, members, scope, loading }: WeekPanelProps) {
  const rangeText = `${formatDateKo(agenda.range.start)} ~ ${formatDateKo(agenda.range.end)}`;

  return (
    <Card className="flex h-full flex-col gap-5">
      <SectionHeading as="h2" description={`${rangeText} · 오늘부터 7일`}>
        오늘·이번 주
      </SectionHeading>

      {loading ? (
        <InlineLoading label="일정을 불러오는 중입니다…" />
      ) : (
        <>
          <SessionSection days={agenda.days} count={agenda.sessionCount} today={today} scope={scope} />
          <DueCardSection cards={agenda.dueCards} today={today} members={members} scope={scope} />
        </>
      )}
    </Card>
  );
}

function SessionSection({
  days,
  count,
  today,
  scope,
}: {
  days: AgendaDay[];
  count: number;
  today: DateString;
  scope: HomeScope;
}) {
  const mine = scope === "mine";
  return (
    <Section as="h3" id={HOME_SECTION_IDS.sessions} jumpTarget title={mine ? "내 강의" : "강의"} meta={`${count}건`}>
      {days.length === 0 ? (
        <p className="text-sm text-muted">
          {mine ? "7일 안에 내가 맡은 과정의 강의가 없습니다." : "7일 안에 예정된 강의가 없습니다."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {days.map((day) => {
            const dayBadge = sessionDayBadge(day.date, today);
            return (
              <li key={day.date} className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {formatDateKo(day.date)}
                  {dayBadge ? <Badge tone={dayBadge.tone}>{dayBadge.text}</Badge> : null}
                </p>
                <ul className="-mx-3 flex flex-col">
                  {day.sessions.map(({ session, course }) => {
                    const place = sessionPlaceLabel(session);
                    return (
                      <li key={`${course.id}-${session.id}`}>
                        <RowLink href={`/courses/${course.id}`}>
                          <span className="font-semibold text-ink">
                            {session.startTime ? (
                              <span className="mr-2 text-primary whitespace-nowrap">{session.startTime}</span>
                            ) : null}
                            {course.title}
                          </span>
                          {place ? <span className="text-sm text-muted">{place}</span> : null}
                        </RowLink>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function dueBadge(dueDate: DateString, today: DateString): { tone: BadgeTone; text: string } {
  const status = dueStatus(dueDate, today);
  if (status === "overdue") return { tone: "danger", text: relativeDayLabel(dueDate, today) };
  if (status === "today") return { tone: "warning", text: "오늘 마감" };
  if (status === "soon") return { tone: "warning", text: `${relativeDayLabel(dueDate, today)} 마감` };
  return { tone: "neutral", text: `${relativeDayLabel(dueDate, today)} 마감` };
}

function DueCardSection({
  cards,
  today,
  members,
  scope,
}: {
  cards: AgendaCard[];
  today: DateString;
  members: readonly Member[];
  scope: HomeScope;
}) {
  const mine = scope === "mine";
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cards : cards.slice(0, DUE_PREVIEW_COUNT);
  const hiddenCount = cards.length - visible.length;

  return (
    <Section
      as="h3"
      id={HOME_SECTION_IDS.dueCards}
      jumpTarget
      title={mine ? "나에게 맡긴 마감 카드" : "마감이 다가온 카드"}
      meta={`${cards.length}장`}
    >
      {cards.length === 0 ? (
        <p className="text-sm text-muted">
          {mine
            ? "마감이 지났거나 7일 안에 마감인 내 카드가 없습니다."
            : "마감이 지났거나 7일 안에 마감인 카드가 없습니다."}
        </p>
      ) : (
        <ul className="-mx-3 flex flex-col">
          {visible.map(({ card, course }) => {
            const badge = card.dueDate ? dueBadge(card.dueDate, today) : null;
            const assignee = card.assigneeEmail ? labelForEmail(card.assigneeEmail, members) : "담당자 없음";
            return (
              <li key={`${course.id}-${card.id}`}>
                <RowLink href={`/courses/${course.id}?card=${encodeURIComponent(card.id)}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{card.title}</span>
                    {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : null}
                  </span>
                  <span className="text-sm text-muted">
                    {course.title} · {stageLabel(card.stage)} ·{" "}
                    {/* 이름이 없으면 이메일이 나오므로 칸을 넘치지 않게 끊는다 */}
                    <span className={assignee.includes("@") ? "break-anywhere" : undefined}>{assignee}</span>
                  </span>
                </RowLink>
              </li>
            );
          })}
        </ul>
      )}
      {hiddenCount > 0 || expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "접기" : `${hiddenCount}장 더 보기`}
        </Button>
      ) : null}
    </Section>
  );
}
