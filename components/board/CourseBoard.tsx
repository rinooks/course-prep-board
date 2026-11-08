"use client";

// 과정 보드 화면의 입구: 데이터를 구독하고, 열 수 없는 경우(잘못된 주소·없는 과정·휴지통)를 가려낸 뒤
// 본문(CourseBoardBody)을 보여준다. 과정을 휴지통으로 옮기는 확인 창도 여기서 맡는다.

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { trashCourse } from "@/lib/data/courses";
import { isSafeId } from "@/lib/domain/ids";
import { BoardStatePage } from "./BoardStatePage";
import { CourseBoardBody } from "./CourseBoardBody";
import { CourseUnavailable } from "./CourseUnavailable";
import { useCourseBoardData } from "./useCourseBoardData";
import { useToday } from "./useToday";

const APP_TITLE = "강의 준비 보드";

export function CourseBoard({ courseId }: { courseId: string }) {
  const validId = isSafeId(courseId);
  const data = useCourseBoardData(validId ? courseId : null);
  const { isAdmin } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const today = useToday();

  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const course = data.course.value;

  // 브라우저 탭 제목에 과정 이름을 붙인다. 화면을 떠나면 원래대로 돌린다
  const courseTitle = course?.title ?? null;
  useEffect(() => {
    if (!courseTitle) return;
    const previous = document.title;
    document.title = `${courseTitle} · ${APP_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, [courseTitle]);

  async function handleTrash() {
    await trashCourse(courseId);
    setLeaving(true);
    toast.success("과정을 휴지통으로 옮겼습니다. 보관함의 휴지통에서 되살릴 수 있습니다.");
    router.push("/");
  }

  // 어느 상태든 네이비 타일 + 본문을 그린다. 보드 본문과 CourseUnavailable은 타일를 스스로 그리고,
  // 그 밖의 상태(불러오는 중·오류·이동 중)는 여기서 BoardStatePage로 감싼다.
  let page: ReactNode;
  if (!validId) {
    page = <CourseUnavailable reason="missing" />;
  } else if (leaving) {
    page = (
      <BoardStatePage title="과정을 휴지통으로 옮겼습니다">
        <LoadingBlock label="홈으로 이동하는 중입니다…" />
      </BoardStatePage>
    );
  } else if (!data.course.loaded) {
    page = data.course.error ? (
      <BoardStatePage title="과정을 열 수 없습니다">
        <Alert
          tone="error"
          title="과정을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={data.course.retry}>
              다시 시도
            </Button>
          }
        >
          {data.course.error}
        </Alert>
      </BoardStatePage>
    ) : (
      <BoardStatePage title="과정을 불러오는 중입니다">
        <LoadingBlock label="과정을 불러오는 중입니다…" />
      </BoardStatePage>
    );
  } else if (course === null) {
    page = <CourseUnavailable reason="missing" />;
  } else if (course.deletedAt !== null) {
    page = <CourseUnavailable reason="trashed" course={course} isAdmin={isAdmin} />;
  } else {
    page = (
      <CourseBoardBody
        course={course}
        data={data}
        today={today}
        isAdmin={isAdmin}
        onRequestTrash={() => setTrashConfirmOpen(true)}
      />
    );
  }

  // 확인 창을 늘 같은 자리(두 번째)에 두어야, 휴지통으로 옮기는 순간 본문이 바뀌어도
  // 창의 진행 표시와 오류 안내가 사라지지 않는다
  return (
    <>
      {page}
      <ConfirmDialog
        open={trashConfirmOpen}
        onClose={() => setTrashConfirmOpen(false)}
        onConfirm={handleTrash}
        title="이 과정을 휴지통으로 옮길까요?"
        description={
          <>
            <strong className="font-semibold">{course?.title ?? "이 과정"}</strong> 과정이 홈과 보관함에서
            사라집니다. 관리자는 보관함의 휴지통에서 되살릴 수 있습니다.
          </>
        }
        confirmLabel="휴지통으로 이동"
        tone="danger"
      />
    </>
  );
}
