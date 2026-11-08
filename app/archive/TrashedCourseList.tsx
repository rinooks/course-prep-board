"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import type { Course, Member } from "@/lib/data/types";
import { TrashedCourseItem } from "./TrashedCourseItem";

interface TrashedCourseListProps {
  courses: Course[] | null;
  error: string | null;
  onRetry: () => void;
  members: readonly Member[];
}

/** 휴지통 (관리자 전용, 최근에 지운 순) */
export function TrashedCourseList({ courses, error, onRetry, members }: TrashedCourseListProps) {
  if (error) {
    return (
      <Alert
        tone="error"
        title="휴지통을 불러오지 못했습니다"
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!courses) return <LoadingBlock label="휴지통을 불러오는 중입니다…" />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        휴지통에 있는 과정은 관리자만 볼 수 있습니다. 되살리면 지우기 전 상태(진행 중 또는 보관)로 돌아갑니다.
      </p>
      {courses.length === 0 ? (
        <EmptyState
          title="휴지통이 비어 있습니다"
          description="관리자가 휴지통으로 보낸 과정이 이곳에 모입니다."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => (
            <li key={course.id}>
              <TrashedCourseItem course={course} members={members} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
