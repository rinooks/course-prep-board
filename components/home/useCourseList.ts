"use client";

// 과정 목록 실시간 구독. 홈(진행 중)과 보관함(보관·휴지통)이 같이 쓴다.

import { useCallback, useEffect, useState } from "react";
import { subscribeCourses, type CourseListFilter } from "@/lib/data/courses";
import type { Course } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

export interface CourseListState {
  /** 아직 한 번도 못 받았으면 null */
  courses: Course[] | null;
  /** 구독이 끊겼을 때 보여줄 문구 */
  error: string | null;
  /** 구독을 다시 연다 ("다시 시도" 버튼) */
  retry: () => void;
}

/** enabled가 false면 구독하지 않는다 (예: 관리자가 아니면 휴지통을 읽지 않음) */
export function useCourseList(filter: CourseListFilter, enabled = true): CourseListState {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeCourses(
      filter,
      (list) => {
        setCourses(list);
        setError(null);
      },
      (caught) => setError(toUserMessage(caught)),
    );
    return unsubscribe;
  }, [filter, enabled, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { courses, error, retry };
}
