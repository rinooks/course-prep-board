"use client";

// 보드를 열 수 없을 때의 안내: 없는 과정이거나, 휴지통에 있는 과정.
// 휴지통 과정은 관리자에게만 "되살리기" 버튼을 보여준다 (보안 규칙도 관리자만 허용한다).
// 네이비 타일(BoardStatePage)까지 여기서 그린다.

import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { restoreCourse } from "@/lib/data/courses";
import type { Course } from "@/lib/data/types";
import { BoardStatePage } from "./BoardStatePage";

type CourseUnavailableProps =
  | { reason: "missing" }
  | { reason: "trashed"; course: Course; isAdmin: boolean };

const PAGE_TITLE = "과정을 열 수 없습니다";

export function CourseUnavailable(props: CourseUnavailableProps) {
  if (props.reason === "missing") {
    return (
      <BoardStatePage title={PAGE_TITLE}>
        <EmptyState
          title="과정을 찾을 수 없습니다"
          description="주소가 잘못되었거나 과정이 완전히 지워졌습니다. 홈이나 보관함에서 과정을 다시 골라 주세요."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/">홈으로</ButtonLink>
              <ButtonLink href="/archive" variant="outline">
                보관함 보기
              </ButtonLink>
            </div>
          }
        />
      </BoardStatePage>
    );
  }
  return <TrashedCourseNotice course={props.course} isAdmin={props.isAdmin} />;
}

function TrashedCourseNotice({ course, isAdmin }: { course: Course; isAdmin: boolean }) {
  const restore = useAsyncAction(() => restoreCourse(course.id));

  return (
    <BoardStatePage title={PAGE_TITLE}>
      {/* 되살리기 실패 안내는 버튼 바로 아래에 붙여 둔다 */}
      <div className="flex flex-col gap-3">
        <EmptyState
          title={`'${course.title}' 과정은 휴지통에 있습니다`}
          description={
            isAdmin
              ? "보드를 다시 쓰려면 과정을 되살려 주세요. 되살리면 휴지통에 넣기 전 상태(진행 중 또는 보관)로 돌아갑니다."
              : "휴지통에 있는 과정은 볼 수 없습니다. 다시 써야 한다면 관리자에게 되살려 달라고 요청해 주세요."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {isAdmin ? (
                <Button onClick={() => restore.run()} loading={restore.pending} loadingLabel="되살리는 중">
                  과정 되살리기
                </Button>
              ) : null}
              <ButtonLink href="/" variant={isAdmin ? "outline" : "solid"}>
                홈으로
              </ButtonLink>
            </div>
          }
        />
        {restore.error ? (
          <Alert tone="error" title="과정을 되살리지 못했습니다">
            {restore.error}
          </Alert>
        ) : null}
      </div>
    </BoardStatePage>
  );
}
