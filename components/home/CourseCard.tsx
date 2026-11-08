import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { CourseDot } from "@/components/course/CourseDot";
import { sessionDayBadge } from "@/components/course/dayBadge";
import { StageTrack } from "@/components/course/StageTrack";
import type { Member } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { stageIndex, stageLabel } from "@/lib/domain/stages";
import type { CourseOverview } from "./homeOverview";
import { instructorSummary, sessionWhenLabel } from "./labels";
import { ProgressBar } from "./ProgressBar";

interface CourseCardProps {
  overview: CourseOverview;
  members: readonly Member[];
  today: DateString;
}

/** 홈의 과정 카드 하나. 누르면 과정 보드로 간다. */
export function CourseCard({ overview, members, today }: CourseCardProps) {
  const { course, loaded, progress, nextSession } = overview;

  return (
    <Link
      href={`/courses/${course.id}`}
      className={cn("group block h-full rounded-tile", focusRing)}
    >
      <Card interactive className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="flex gap-2 text-lg font-bold tracking-tight text-ink text-balance group-hover:text-primary">
            {/* 제목이 여러 줄이어도 점은 첫 줄 가운데에 둔다 (h-7 = text-lg 한 줄 높이) */}
            <span className="flex h-7 shrink-0 items-center">
              <CourseDot courseId={course.id} />
            </span>
            <span className="min-w-0">{course.title}</span>
          </h3>
          <p className="text-sm text-muted">{course.client || "고객사 미입력"}</p>
        </div>

        {loaded && progress.totalCards > 0 ? <StageTrack progress={progress} /> : null}

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-16 shrink-0 text-muted">다음 강의</dt>
            <dd className="flex flex-wrap items-center gap-2 text-ink">
              <NextSessionValue loaded={loaded} today={today} nextSession={nextSession} />
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-16 shrink-0 text-muted">현재 단계</dt>
            <dd>
              <StageBadge overview={overview} />
            </dd>
          </div>
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <dt className="w-16 shrink-0 text-muted">담당 강사</dt>
            <dd className="min-w-0 flex-1 text-ink">{instructorSummary(course.instructorEmails, members)}</dd>
          </div>
        </dl>

        <div className="mt-auto">
          {loaded ? (
            <ProgressBar
              done={progress.doneCards}
              total={progress.totalCards}
              percent={progress.percent}
              label={`${course.title} 진행률`}
            />
          ) : (
            <p className="text-sm text-muted">진행률을 불러오는 중입니다…</p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function NextSessionValue({
  loaded,
  today,
  nextSession,
}: {
  loaded: boolean;
  today: DateString;
  nextSession: CourseOverview["nextSession"];
}) {
  if (!loaded) return <span className="text-muted">불러오는 중…</span>;
  if (!nextSession) return <span className="text-muted">예정된 강의 없음</span>;

  const dayBadge = sessionDayBadge(nextSession.date, today);
  return (
    <>
      <span>{sessionWhenLabel(nextSession)}</span>
      {dayBadge ? <Badge tone={dayBadge.tone}>{dayBadge.text}</Badge> : null}
    </>
  );
}

function StageBadge({ overview }: { overview: CourseOverview }) {
  const { loaded, progress } = overview;
  if (!loaded) return <span className="text-muted">불러오는 중…</span>;
  if (progress.totalCards === 0) return <Badge>카드 없음</Badge>;
  if (progress.allDone || progress.currentStageId === null) {
    return <Badge tone="success">모든 단계 완료</Badge>;
  }
  const order = stageIndex(progress.currentStageId) + 1;
  return (
    <Badge tone="primary">
      {order}단계 · {stageLabel(progress.currentStageId)}
    </Badge>
  );
}
