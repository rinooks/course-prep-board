"use client";

import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NoticesBand } from "@/components/notices/NoticesBand";
import { Alert } from "@/components/ui/Alert";
import { BentoGrid } from "@/components/ui/Bento";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/Section";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageBody, PageHeaderTile } from "@/components/layout/Page";
import type { Course, Member } from "@/lib/data/types";
import type { CourseDetail } from "@/lib/data/overview";
import { formatDateKo, type DateString } from "@/lib/domain/dates";
import { CourseCard } from "./CourseCard";
import { HomeScopeToggle } from "./HomeScopeToggle";
import {
  agendaInScope,
  averagePercent,
  buildAgenda,
  buildCourseOverviews,
  courseIdsKey,
  coursesInScope,
  type HomeScope,
} from "./homeOverview";
import { HOME_SECTION_IDS, StatTiles } from "./StatTiles";
import { useCourseList } from "./useCourseList";
import { useCoursesDetails } from "./useCoursesDetails";
import { useHomeScope } from "./useHomeScope";
import { useTeamMembers } from "./useTeamMembers";
import { useToday } from "./useToday";
import { WeekPanel } from "./WeekPanel";

const NO_MEMBERS: Member[] = [];

/** 홈: 벤토 격자로 현황 타일·요약 숫자, 진행 중인 과정 타일(다음 강의 순), "오늘·이번 주"를 보여 준다. 팀 전체 / 내 것만으로 바꿔 볼 수 있다. */
export function HomeScreen() {
  const today = useToday();
  const { email } = useAuth();
  const [savedScope, setScope] = useHomeScope();
  // 팀원이면 이메일이 항상 있다. 혹시 없으면 "내 것"을 가릴 수 없으므로 팀 전체로 본다
  const scope: HomeScope = email ? savedScope : "team";

  const active = useCourseList("active");
  // 팀원 목록은 이름 표시용이다. 못 받아도 이메일로 보여주면 되므로 따로 오류를 띄우지 않는다.
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  // 내 것만 볼 때도 모든 과정의 카드를 받는다. 담당 강사가 아닌 과정에서도 나에게 맡긴 카드가 있을 수 있다.
  const idsKey = courseIdsKey(active.courses ?? []);
  const detailsState = useCoursesDetails(idsKey);

  const hero = (
    <PageHeaderTile
      eyebrow={today ? formatDateKo(today) : null}
      title="강의 준비 현황"
      description={headerDescription(active.courses, scope, email)}
      actions={
        <ButtonLink href="/courses/new" variant="inverse" size="sm">
          <PlusIcon />
          새 과정 만들기
        </ButtonLink>
      }
    >
      {email ? <HomeScopeToggle scope={scope} onChange={setScope} /> : null}
    </PageHeaderTile>
  );

  return (
    <PageBody>
      <HomeBody
        hero={hero}
        today={today}
        scope={scope}
        email={email}
        onShowTeam={() => setScope("team")}
        courses={active.courses}
        coursesError={active.error}
        onRetryCourses={active.retry}
        details={detailsState.details}
        detailsError={detailsState.error}
        onRetryDetails={detailsState.retry}
        members={members}
      />
    </PageBody>
  );
}

function headerDescription(courses: Course[] | null, scope: HomeScope, email: string | null): string {
  if (!courses) return "진행 중인 과정을 불러오는 중입니다";
  if (scope === "mine" && email) {
    const mineCount = coursesInScope(courses, "mine", email).length;
    return `진행 중인 과정 ${courses.length}개 중 내가 맡은 과정 ${mineCount}개 · 다음 강의가 가까운 순`;
  }
  return `진행 중인 과정 ${courses.length}개 · 다음 강의가 가까운 순`;
}

interface HomeBodyProps {
  /** 맨 위 네이비 타일. 데이터를 받기 전에는 혼자 한 줄을 쓰고, 받은 뒤에는 요약 숫자와 나란히 놓인다 */
  hero: ReactNode;
  today: DateString | null;
  scope: HomeScope;
  email: string | null;
  onShowTeam: () => void;
  courses: Course[] | null;
  coursesError: string | null;
  onRetryCourses: () => void;
  details: Record<string, CourseDetail>;
  detailsError: string | null;
  onRetryDetails: () => void;
  members: readonly Member[];
}

function HomeBody({
  hero,
  today,
  scope,
  email,
  onShowTeam,
  courses,
  coursesError,
  onRetryCourses,
  details,
  detailsError,
  onRetryDetails,
  members,
}: HomeBodyProps) {
  const scopedCourses = useMemo(
    () => (courses && email ? coursesInScope(courses, scope, email) : courses),
    [courses, scope, email],
  );
  const overviews = useMemo(
    () => (scopedCourses && today ? buildCourseOverviews(scopedCourses, details, today) : []),
    [scopedCourses, details, today],
  );
  const agenda = useMemo(() => {
    if (!courses || !today) return null;
    const teamAgenda = buildAgenda(courses, details, today);
    return email ? agendaInScope(teamAgenda, scope, email) : teamAgenda;
  }, [courses, details, today, scope, email]);

  if (coursesError) {
    return (
      <>
        {hero}
        <NoticesBand />
        <Alert
          tone="error"
          title="진행 중인 과정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetryCourses}>
              다시 시도
            </Button>
          }
        >
          {coursesError}
        </Alert>
      </>
    );
  }

  if (!courses || !today || !agenda) {
    return (
      <>
        {hero}
        <NoticesBand />
        <LoadingBlock label="진행 중인 과정을 불러오는 중입니다…" />
      </>
    );
  }

  if (courses.length === 0) {
    return (
      <>
        {hero}
        <NoticesBand />
        <EmptyState
          title="진행 중인 과정이 없습니다"
          description="새 과정을 만들면 7단계 칸과 단계별 기본 카드가 자동으로 생깁니다. 끝나서 보관한 과정은 보관함에서 볼 수 있습니다."
          action={<ButtonLink href="/courses/new">새 과정 만들기</ButtonLink>}
        />
      </>
    );
  }

  // "오늘·이번 주"는 모든 과정의 카드에서 모으므로, 모든 과정을 받아야 다 받은 것이다
  const allLoaded = courses.every((course) => details[course.id]?.loaded ?? false);
  const average = averagePercent(overviews);
  const noneLoaded = overviews.length > 0 && overviews.every((overview) => !overview.loaded);
  const mine = scope === "mine";

  // 타일끼리 간격은 PageBody와 BentoGrid(gap-4)가 정한다
  return (
    <>
      <BentoGrid layout="main-side">
        {hero}
        <StatTiles
          scope={scope}
          courseCount={overviews.length}
          weekSessionCount={agenda.sessionCount}
          dueCardCount={agenda.dueCards.length}
          averagePercent={average}
        />
      </BentoGrid>

      <NoticesBand />

      {detailsError ? (
        <Alert
          tone="error"
          title="진행률과 일정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={onRetryDetails}>
              다시 시도
            </Button>
          }
        >
          {detailsError}
        </Alert>
      ) : null}

      {/* 휴대폰에서는 "오늘·이번 주"를 먼저, 넓은 화면에서는 오른쪽에 둔다 */}
      <BentoGrid layout="main-side">
        <aside aria-label="오늘·이번 주 일정" className="lg:col-start-2 lg:row-start-1">
          <WeekPanel
            agenda={agenda}
            today={today}
            members={members}
            scope={scope}
            loading={!allLoaded && !detailsError}
          />
        </aside>

        <Section
          id={HOME_SECTION_IDS.courses}
          jumpTarget
          hideHeading
          title={mine ? "내가 맡은 과정" : "진행 중인 과정"}
          description="다음 강의가 가까운 순"
          className="lg:col-start-1 lg:row-start-1"
        >
          {overviews.length === 0 ? (
            <EmptyState
              className="justify-center lg:flex-1"
              title="내가 담당 강사인 진행 중 과정이 없습니다"
              description="과정 보드의 '과정 정보 수정'에서 담당 강사로 나를 넣으면 여기에 보입니다. 나에게 맡긴 카드는 '오늘·이번 주'에 따로 모입니다."
              action={
                <Button variant="outline" onClick={onShowTeam}>
                  팀 전체 보기
                </Button>
              }
            />
          ) : noneLoaded && !detailsError ? (
            <LoadingBlock label="과정별 진행률을 불러오는 중입니다…" />
          ) : (
            // 격자에 구멍이 생기지 않게: 2칸으로 놓고 홀수 개면 마지막 타일을 넓히며, 넓은 화면에서는 옆 타일과 아래 끝을 맞춘다
            <ul className="grid gap-4 md:grid-cols-2 lg:flex-1 lg:auto-rows-fr">
              {overviews.map((overview) => (
                <li key={overview.course.id} className="md:odd:last:col-span-2">
                  <CourseCard overview={overview} members={members} today={today} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </BentoGrid>
    </>
  );
}
