"use client";

import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import type { Course, Member } from "@/lib/data/types";
import { ArchivedCourseItem } from "./ArchivedCourseItem";

interface ArchivedCourseListProps {
  courses: Course[] | null;
  error: string | null;
  onRetry: () => void;
  members: readonly Member[];
  isAdmin: boolean;
}

/** 보관된 과정 목록 (최근 수정 순) */
export function ArchivedCourseList({ courses, error, onRetry, members, isAdmin }: ArchivedCourseListProps) {
  if (error) {
    return (
      <Alert
        tone="error"
        title="보관된 과정을 불러오지 못했습니다"
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

  if (!courses) return <LoadingBlock label="보관된 과정을 불러오는 중입니다…" />;

  if (courses.length === 0) {
    return (
      <EmptyState
        title="보관된 과정이 없습니다"
        description="강의가 끝난 과정은 과정 보드에서 보관하면 이곳으로 옮겨지고 홈 목록에서 빠집니다."
        action={
          <ButtonLink href="/" variant="outline">
            홈으로 가기
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {courses.map((course) => (
        <li key={course.id}>
          <ArchivedCourseItem course={course} members={members} isAdmin={isAdmin} />
        </li>
      ))}
    </ul>
  );
}
