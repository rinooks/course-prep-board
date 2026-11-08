"use client";

import { epochDateLabel, instructorSummary } from "@/components/home/labels";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { restoreCourse } from "@/lib/data/courses";
import { labelForEmail } from "@/lib/data/members";
import type { Course, Member } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

interface TrashedCourseItemProps {
  course: Course;
  members: readonly Member[];
}

/** 휴지통의 과정 한 줄 (관리자 전용): 되살리기 */
export function TrashedCourseItem({ course, members }: TrashedCourseItemProps) {
  const toast = useToast();
  const deletedLabel = epochDateLabel(course.deletedAt);
  const deletedBy = course.deletedBy ? labelForEmail(course.deletedBy, members) : null;
  const returnsTo = course.status === "archived" ? "보관함" : "홈";

  async function handleRestore() {
    try {
      await restoreCourse(course.id);
      toast.success(`‘${course.title}’ 과정을 되살렸습니다. ${returnsTo}에서 볼 수 있습니다.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-ink">
          {course.title}
          <Badge>{course.status === "archived" ? "보관됐던 과정" : "진행 중이던 과정"}</Badge>
        </h3>
        <p className="text-sm text-muted">
          {course.client || "고객사 미입력"} · 담당 {instructorSummary(course.instructorEmails, members)}
        </p>
        {deletedLabel || deletedBy ? (
          <p className="text-sm text-muted">
            휴지통으로 보낸 날 {deletedLabel ?? "확인 중"}
            {deletedBy ? (
              <>
                {" · "}
                <span className={deletedBy.includes("@") ? "break-anywhere" : undefined}>{deletedBy}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-1 md:items-end">
        <Button variant="outline" size="sm" loadingLabel="되살리는 중" onClick={handleRestore}>
          되살리기
        </Button>
        <span className="text-sm text-muted">되살리면 {returnsTo}으로 돌아갑니다</span>
      </div>
    </Card>
  );
}
