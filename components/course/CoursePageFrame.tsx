"use client";

// 과정의 재료함·초안·결과물 화면 공통 틀.
// 과정을 구독하고, 열 수 없는 경우(잘못된 주소·없는 과정·휴지통)를 보드와 같은 안내로 가려낸 뒤
// 네이비 타일(과정 이름 + 탭 메뉴)와 본문을 그린다. 보드 화면은 요약 칸이 많아 CourseBoard가 따로 그린다.

import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BoardStatePage } from "@/components/board/BoardStatePage";
import { CourseUnavailable } from "@/components/board/CourseUnavailable";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingBlock } from "@/components/ui/Spinner";
import { subscribeCourse } from "@/lib/data/courses";
import type { Course } from "@/lib/data/types";
import { isSafeId } from "@/lib/domain/ids";
import { CourseDot } from "./CourseDot";
import { COURSE_TAB_LABELS, CourseTabs, type CourseTab } from "./CourseTabs";

const APP_TITLE = "강의 준비 보드";

interface CoursePageFrameProps {
  courseId: string;
  tab: Exclude<CourseTab, "board">;
  /** 타일 안 제목 아래 설명 (이 탭에서 하는 일) */
  description: ReactNode;
  /** 타일 오른쪽 버튼 */
  actions?: (course: Course) => ReactNode;
  /** 본문. 과정을 받은 뒤에만 그린다 */
  children: (course: Course) => ReactNode;
}

export function CoursePageFrame({ courseId, tab, description, actions, children }: CoursePageFrameProps) {
  const validId = isSafeId(courseId);
  const { isAdmin } = useAuth();
  const course = useLiveSubscription<Course | null>(
    validId ? courseId : null,
    (onData, onError) => subscribeCourse(courseId, onData, onError),
    null,
  );

  // 브라우저 탭 제목: "재료함 · 과정 이름 · 강의 준비 보드". 떠나면 원래대로
  const courseTitle = course.value?.title ?? null;
  useEffect(() => {
    if (!courseTitle) return;
    const previous = document.title;
    document.title = `${COURSE_TAB_LABELS[tab]} · ${courseTitle} · ${APP_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, [courseTitle, tab]);

  if (!validId) return <CourseUnavailable reason="missing" />;
  if (!course.loaded) {
    return course.error ? (
      <BoardStatePage title="과정을 열 수 없습니다">
        <Alert
          tone="error"
          title="과정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={course.retry}>
              다시 시도
            </Button>
          }
        >
          {course.error}
        </Alert>
      </BoardStatePage>
    ) : (
      <BoardStatePage title="과정을 불러오는 중입니다">
        <LoadingBlock label="과정을 불러오는 중입니다…" />
      </BoardStatePage>
    );
  }
  const value = course.value;
  if (value === null) return <CourseUnavailable reason="missing" />;
  if (value.deletedAt !== null) return <CourseUnavailable reason="trashed" course={value} isAdmin={isAdmin} />;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CourseDot courseId={value.id} />
            <span>{value.client || "고객사 미입력"}</span>
            {value.status === "archived" ? <Badge tone="inverse">보관됨</Badge> : null}
          </>
        }
        title={value.title}
        description={description}
        actions={actions ? actions(value) : undefined}
        tabs={<CourseTabs courseId={value.id} current={tab} />}
      />
      <PageBody>
        {course.error ? (
          <Alert
            tone="warning"
            title="실시간 연결이 끊겼습니다"
            action={
              <Button variant="outline" size="sm" onClick={course.retry}>
                다시 시도
              </Button>
            }
          >
            보이는 과정 정보가 최신이 아닐 수 있습니다. {course.error}
          </Alert>
        ) : null}
        {children(value)}
      </PageBody>
    </>
  );
}
