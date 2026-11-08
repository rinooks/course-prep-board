"use client";

// 과정 보드 머리(네이비 타일): 과정 이름·고객사·설명, 담당 강사, 다음 강의, 현재 단계, 진행률.
// 버튼: 과정 정보 수정, 캘린더에서 보기, 과정 복제, 보관/보관 해제(팀원 누구나), 휴지통으로(관리자만).
// 타일 위 보조 글자는 모두 text-primary-foreground/80 하나로 쓴다 (design.md 2장 "그 밖의 허용 값").

import { useState, type ReactNode } from "react";
import { CourseTabs } from "@/components/course/CourseTabs";
import { sessionDayBadge } from "@/components/course/dayBadge";
import { StageTrack } from "@/components/course/StageTrack";
import { PageHeaderTile } from "@/components/layout/Page";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { archiveCourse, unarchiveCourse } from "@/lib/data/courses";
import { labelForEmail } from "@/lib/data/members";
import type { Card, ChecklistItem, Course, Member, Session } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { toUserMessage } from "@/lib/domain/errors";
import type { CourseProgress } from "@/lib/domain/progress";
import { nextSession } from "@/lib/domain/schedule";
import { stageLabel } from "@/lib/domain/stages";
import { CourseCopyModal } from "./CourseCopyModal";
import { CourseEditModal } from "./CourseEditModal";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { sessionWhen } from "./sessionDisplay";

/** 타일 위 보조 글자 */
const HELPER_TEXT = "font-normal text-primary-foreground/80";

interface CourseHeaderProps {
  course: Course;
  members: readonly Member[];
  membersLoaded: boolean;
  sessions: readonly Session[];
  sessionsLoaded: boolean;
  progress: CourseProgress;
  cards: readonly Card[];
  cardsLoaded: boolean;
  checklistItems: readonly ChecklistItem[];
  /** 체크리스트를 오류 없이 다 받았는지 (복제할 때 필요) */
  checklistLoaded: boolean;
  today: DateString;
  isAdmin: boolean;
  onRequestTrash: () => void;
}

export function CourseHeader({
  course,
  members,
  membersLoaded,
  sessions,
  sessionsLoaded,
  progress,
  cards,
  cardsLoaded,
  checklistItems,
  checklistLoaded,
  today,
  isAdmin,
  onRequestTrash,
}: CourseHeaderProps) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const archived = course.status === "archived";

  async function toggleArchive() {
    try {
      if (archived) {
        await unarchiveCourse(course.id);
        toast.success("보관을 풀었습니다. 홈의 진행 중인 과정에 다시 보입니다.");
      } else {
        await archiveCourse(course.id);
        toast.success("보관함으로 옮겼습니다. 홈에는 보이지 않고 보관함에서 찾을 수 있습니다.");
      }
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const instructors = course.instructorEmails.map((email) => labelForEmail(email, members));
  const upcoming = nextSession(sessions, today);
  const upcomingBadge = upcoming ? sessionDayBadge(upcoming.date, today, true) : null;
  const progressText = `카드 ${progress.totalCards}장 중 ${progress.doneCards}장 끝남`;

  return (
    <>
      <PageHeaderTile
        stacked
        eyebrow={
          course.client || archived ? (
            <>
              {course.client ? <span>{course.client}</span> : null}
              {archived ? <Badge tone="inverse">보관됨</Badge> : null}
            </>
          ) : null
        }
        title={course.title}
        description={course.description ? <p className="whitespace-pre-line">{course.description}</p> : null}
        tabs={<CourseTabs courseId={course.id} current="board" />}
        actions={
          <>
            <Button variant="inverseOutline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              과정 정보 수정
            </Button>
            {/* 캘린더는 진행 중인 과정만 보여 주므로 보관한 과정에는 두지 않는다 */}
            {archived ? null : (
              <ButtonLink
                href={`/calendar?course=${encodeURIComponent(course.id)}`}
                variant="inverseOutline"
                size="sm"
              >
                캘린더에서 보기
              </ButtonLink>
            )}
            {/* 카드를 다 받기 전에는 복제할 내용이 정해지지 않으므로 누를 수 없다 */}
            <Button variant="inverseOutline" size="sm" disabled={!cardsLoaded} onClick={() => setCopying(true)}>
              과정 복제
            </Button>
            <Button variant="inverseOutline" size="sm" onClick={toggleArchive} loadingLabel="저장하는 중">
              {archived ? "보관 해제" : "보관"}
            </Button>
            {isAdmin ? (
              <Button variant="inverseOutline" size="sm" onClick={onRequestTrash}>
                <TrashIcon />
                휴지통으로 이동
              </Button>
            ) : null}
          </>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetaTile label="담당 강사">
            {instructors.length > 0 ? (
              <span className="break-anywhere">{instructors.join(", ")}</span>
            ) : (
              <span className={HELPER_TEXT}>아직 정하지 않았습니다</span>
            )}
          </MetaTile>

          <MetaTile label="다음 강의">
            {!sessionsLoaded ? (
              <span className={HELPER_TEXT}>불러오는 중…</span>
            ) : upcoming ? (
              <span className="flex flex-wrap items-center gap-2">
                {sessionWhen(upcoming, today)}
                {upcomingBadge ? <Badge tone={upcomingBadge.tone}>{upcomingBadge.text}</Badge> : null}
              </span>
            ) : (
              <span className={HELPER_TEXT}>예정된 회차가 없습니다</span>
            )}
            {sessionsLoaded ? (
              <span className={cn("mt-0.5 block text-sm", HELPER_TEXT)}>
                전체 회차 {sessions.length}개
                {upcoming?.location ? ` · ${upcoming.location}` : ""}
              </span>
            ) : null}
          </MetaTile>

          <MetaTile label="현재 단계">
            {!cardsLoaded ? (
              <span className={HELPER_TEXT}>불러오는 중…</span>
            ) : progress.currentStageId ? (
              <div className="flex flex-col gap-2">
                {stageLabel(progress.currentStageId)}
                <StageTrack progress={progress} tone="inverse" />
              </div>
            ) : progress.allDone ? (
              "모든 단계 완료"
            ) : (
              <span className={HELPER_TEXT}>카드가 없습니다</span>
            )}
          </MetaTile>

          <MetaTile label="진행률">
            <div className="flex flex-col gap-2">
              <span className="tabular-nums">
                {progress.percent}% <span className={cn("text-sm", HELPER_TEXT)}>({progressText})</span>
              </span>
              <ProgressBar tone="inverse" percent={progress.percent} label="과정 진행률" valueText={progressText} />
            </div>
          </MetaTile>
        </dl>
      </PageHeaderTile>
      {copying ? (
        <CourseCopyModal
          course={course}
          cards={cards}
          checklistItems={checklistItems}
          checklistLoaded={checklistLoaded}
          onClose={() => setCopying(false)}
        />
      ) : null}
      {editing ? (
        <CourseEditModal
          course={course}
          members={members}
          membersLoaded={membersLoaded}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

/** 네이비 타일 안의 요약 칸 하나 */
function MetaTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-primary-foreground/10 p-4">
      <dt className="text-sm text-primary-foreground/80">{label}</dt>
      <dd className="text-base font-semibold text-primary-foreground">{children}</dd>
    </div>
  );
}
