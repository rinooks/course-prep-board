"use client";

// /fees — 강사료: 내가 볼 수 있는 모든 과정의 강사료를 한곳에서 본다.
// - 강사는 자기 강사료만, 관리자는 팀 전체(또는 "내 것만")를 본다.
// - 입금 상태로 거를 수 있고, 고른 값은 주소(?status=, ?scope=)에 둔다.
//   다른 화면(알림 등)이 /fees?status=overdue 로 미입금만 바로 열 수 있다.
// - 고치기·지우기는 과정의 강사료 탭에서 한다 (과정 이름을 누르면 간다). 여기서는 입금 확인·취소만.
// useSearchParams를 쓰므로 app/fees/page.tsx에서 Suspense로 감싼다.

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { useCourseList } from "@/components/home/useCourseList";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { useToday } from "@/components/home/useToday";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { LoadingBlock } from "@/components/ui/Spinner";
import { subscribeFees } from "@/lib/data/fees";
import { labelForEmail } from "@/lib/data/members";
import type { Course, Fee, Member } from "@/lib/data/types";
import { sortFees } from "@/lib/domain/fees";
import {
  countFeesByFilter,
  FEE_FILTER_LABELS,
  FEE_FILTERS,
  feesHref,
  filterFees,
  parseFeeFilter,
  parseFeeScope,
  type FeeFilter,
  type FeeScopeView,
} from "./feeDisplay";
import { FeeRow, type FeeRowCourse } from "./FeeRow";
import { FeeSummaryTiles } from "./FeeSummaryTiles";

const NO_FEES: Fee[] = [];
const NO_MEMBERS: Member[] = [];

const APP_TITLE = "강의 준비 보드";

const SCOPE_OPTIONS: readonly SegmentOption<FeeScopeView>[] = [
  { value: "team", label: "팀 전체" },
  { value: "mine", label: "내 것만" },
];

/** 걸러 보기 결과가 비었을 때 문구 */
const EMPTY_FILTER_TEXT: Record<Exclude<FeeFilter, "all">, string> = {
  overdue: "예정일이 지났는데 입금 확인을 안 한 강사료가 없습니다.",
  upcoming: "입금 예정일을 기다리는 강사료가 없습니다.",
  paid: "입금을 확인한 강사료가 없습니다.",
};

export function FeesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { email, isAdmin } = useAuth();
  const today = useToday();

  const filter = parseFeeFilter(searchParams.get("status"));
  // 강사는 어차피 자기 것만 받으므로 범위를 고르지 않는다
  const scope: FeeScopeView = isAdmin ? parseFeeScope(searchParams.get("scope")) : "mine";

  const fees = useLiveSubscription<Fee[]>(
    email ? `all|${email}|${isAdmin ? "admin" : "instructor"}` : null,
    (onData, onError) => subscribeFees({ email: email ?? "", isAdmin }, onData, onError),
    NO_FEES,
  );
  // 과정 이름·고객사 표시용. 진행 중 + 보관된 과정 (휴지통 과정은 "지운 과정"으로 보인다)
  const active = useCourseList("active");
  const archived = useCourseList("archived");
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  const scoped = useMemo(
    () => (scope === "mine" && email ? fees.value.filter((fee) => fee.instructorEmail === email) : fees.value),
    [fees.value, scope, email],
  );
  const sorted = useMemo(() => (today ? sortFees(scoped, today) : NO_FEES), [scoped, today]);
  const visible = useMemo(() => (today ? filterFees(sorted, filter, today) : NO_FEES), [sorted, filter, today]);
  const counts = useMemo(() => (today ? countFeesByFilter(scoped, today) : null), [scoped, today]);

  const coursesById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const course of [...(active.courses ?? []), ...(archived.courses ?? [])]) map.set(course.id, course);
    return map;
  }, [active.courses, archived.courses]);
  const coursesLoaded = active.courses !== null && archived.courses !== null;
  const coursesError = active.error ?? archived.error;

  function courseFor(courseId: string): FeeRowCourse {
    const course = coursesById.get(courseId);
    if (course) return { kind: "found", id: course.id, title: course.title, client: course.client };
    // 두 목록을 다 받기 전에는 "지운 과정"이라고 단정하지 않는다
    if (coursesLoaded) return { kind: "missing" };
    return coursesError ? { kind: "unavailable" } : { kind: "loading" };
  }

  function navigate(nextFilter: FeeFilter, nextScope: FeeScopeView) {
    router.replace(feesHref(nextFilter, nextScope), { scroll: false });
  }

  function retryCourses() {
    active.retry();
    archived.retry();
  }

  const filterOptions: SegmentOption<FeeFilter>[] = FEE_FILTERS.map((value) => ({
    value,
    label: counts ? `${FEE_FILTER_LABELS[value]} ${counts[value]}` : FEE_FILTER_LABELS[value],
  }));

  // 브라우저 탭 제목: "미입금 강사료 · 강의 준비 보드". 떠나면 원래대로 (과정 화면과 같은 방식)
  useEffect(() => {
    const previous = document.title;
    document.title = filter === "all" ? `강사료 · ${APP_TITLE}` : `${FEE_FILTER_LABELS[filter]} 강사료 · ${APP_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, [filter]);

  const showTeam = isAdmin && scope === "team";
  const loading = !fees.loaded || !today;

  return (
    <>
      <PageHeader
        eyebrow="입금 관리"
        title="강사료"
        description="과정마다 받을 강사료와 입금 여부를 한곳에서 확인합니다. 금액은 강사 본인과 관리자만 볼 수 있습니다."
      >
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              tone="inverse"
              label="보기 범위"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={(next) => navigate(filter, next)}
            />
            <p className="text-sm text-primary-foreground/80">
              {scope === "team" ? "팀 모든 강사의 강사료가 보입니다." : "내가 받을 강사료만 보입니다."}
            </p>
          </div>
        ) : null}
      </PageHeader>

      <PageBody>
        {fees.error ? (
          <Alert
            tone={fees.loaded ? "warning" : "error"}
            title={fees.loaded ? "실시간 연결이 끊겼습니다" : "강사료를 불러오지 못했습니다"}
            action={
              <Button variant="outline" size="sm" onClick={fees.retry}>
                다시 시도
              </Button>
            }
          >
            {fees.loaded ? `보이는 강사료가 최신이 아닐 수 있습니다. ${fees.error}` : fees.error}
          </Alert>
        ) : null}

        {coursesError ? (
          <Alert
            tone="warning"
            title="과정 이름을 불러오지 못했습니다"
            action={
              <Button variant="outline" size="sm" onClick={retryCourses}>
                다시 시도
              </Button>
            }
          >
            강사료는 그대로 볼 수 있지만 과정 이름이 비어 보일 수 있습니다. {coursesError}
          </Alert>
        ) : null}

        {loading && !fees.error ? <LoadingBlock label="강사료를 불러오는 중입니다…" /> : null}

        {!loading && today ? (
          <>
            <FeeSummaryTiles fees={scoped} today={today} />

            <Section
              tile
              title="강사료 목록"
              meta={`${visible.length}건`}
              description="미입금 → 받을 예정 → 입금됨 순입니다. 고치거나 지우려면 과정 이름을 눌러 그 과정의 강사료 탭으로 가세요."
            >
              <SegmentedControl
                label="입금 상태로 거르기"
                options={filterOptions}
                value={filter}
                onChange={(next) => navigate(next, scope)}
              />
              {/* 걸러 보기를 바꾸면 결과 수를 화면 낭독기에 알려 준다 */}
              <p className="sr-only" aria-live="polite">
                {FEE_FILTER_LABELS[filter]} 강사료 {visible.length}건
              </p>

              {scoped.length === 0 ? (
                <EmptyState
                  title={showTeam ? "팀에 등록된 강사료가 없습니다" : "등록한 강사료가 없습니다"}
                  description="과정 화면의 '강사료' 탭에서 받을 금액과 입금 예정일을 추가하면 여기에 모입니다."
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="조건에 맞는 강사료가 없습니다"
                  description={filter === "all" ? undefined : EMPTY_FILTER_TEXT[filter]}
                  action={
                    <Button variant="outline" size="sm" onClick={() => navigate("all", scope)}>
                      전체 보기
                    </Button>
                  }
                />
              ) : (
                // -mx·-mb: 구분선이 타일 끝까지 닿게 타일의 안쪽 여백만큼 넓힌다
                <ul
                  aria-label="강사료 목록"
                  className="-mx-4 -mb-4 divide-y divide-line border-t border-line md:-mx-5 md:-mb-5 md:[&>li]:px-5"
                >
                  {visible.map((fee) => (
                    <FeeRow
                      key={fee.id}
                      fee={fee}
                      today={today}
                      course={courseFor(fee.courseId)}
                      instructorLabel={showTeam ? labelForEmail(fee.instructorEmail, members) : null}
                    />
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
