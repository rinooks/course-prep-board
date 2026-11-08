"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { epochDateLabel, instructorSummary } from "@/components/home/labels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { trashCourse, unarchiveCourse } from "@/lib/data/courses";
import type { Course, Member } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

interface ArchivedCourseItemProps {
  course: Course;
  members: readonly Member[];
  isAdmin: boolean;
}

/** 보관된 과정 한 줄: 진행 중으로 되돌리기, (관리자) 휴지통으로 보내기 */
export function ArchivedCourseItem({ course, members, isAdmin }: ArchivedCourseItemProps) {
  const toast = useToast();
  const [confirmTrash, setConfirmTrash] = useState(false);
  const updatedLabel = epochDateLabel(course.updatedAt);

  // 화면을 떠나면 확인 창을 닫는다 (돌아왔을 때 창이 열린 채로 남지 않게)
  useLayoutEffect(() => {
    return () => setConfirmTrash(false);
  }, []);

  async function handleUnarchive() {
    try {
      await unarchiveCourse(course.id);
      toast.success(`‘${course.title}’ 과정을 진행 중으로 되돌렸습니다. 홈에서 볼 수 있습니다.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function handleTrash() {
    try {
      await trashCourse(course.id);
    } catch (error) {
      // 휴지통 표시는 기기 화면에 먼저 반영되어 이 항목(과 확인 창)이 저장 확인 전에 사라질 수 있다.
      // 창 안의 오류 문구를 못 볼 수 있으므로 화면 아래 알림으로도 알린다.
      toast.error(`‘${course.title}’ 과정을 휴지통으로 보내지 못했습니다. ${toUserMessage(error)}`);
      throw error;
    }
    toast.success(`‘${course.title}’ 과정을 휴지통으로 보냈습니다. 휴지통 탭에서 되살릴 수 있습니다.`);
  }

  return (
    <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-lg font-bold tracking-tight text-ink">
          <Link
            href={`/courses/${course.id}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-button transition hover:text-primary hover:underline motion-reduce:transition-none",
              focusRing,
            )}
          >
            {course.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          {course.client || "고객사 미입력"} · 담당 {instructorSummary(course.instructorEmails, members)}
        </p>
        {updatedLabel ? <p className="text-sm text-muted">마지막 수정 {updatedLabel}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" size="sm" loadingLabel="되돌리는 중" onClick={handleUnarchive}>
          진행 중으로 되돌리기
        </Button>
        {isAdmin ? (
          <Button variant="dangerGhost" size="sm" onClick={() => setConfirmTrash(true)}>
            휴지통으로 보내기
          </Button>
        ) : null}
      </div>

      {isAdmin ? (
        <ConfirmDialog
          open={confirmTrash}
          onClose={() => setConfirmTrash(false)}
          onConfirm={handleTrash}
          tone="danger"
          title="휴지통으로 보낼까요?"
          description={
            <>
              <strong className="font-semibold">‘{course.title}’</strong> 과정이 보관함에서 사라지고 휴지통으로 갑니다.
              휴지통은 관리자만 볼 수 있고, 그곳에서 언제든 되살릴 수 있습니다.
            </>
          }
          confirmLabel="휴지통으로 보내기"
        />
      ) : null}
    </Card>
  );
}
