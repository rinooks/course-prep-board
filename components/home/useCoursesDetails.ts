"use client";

// 여러 과정의 카드·회차·준비 일정을 한 번에 구독한다 (홈의 진행률·다음 강의·이번 주 일정, 팀 캘린더용).

import { useCallback, useEffect, useState } from "react";
import { subscribeCoursesDetails, type CourseDetail } from "@/lib/data/overview";
import { toUserMessage } from "@/lib/domain/errors";

export interface CoursesDetailsState {
  /** 과정 id → 카드·회차·일정. 아직 못 받은 과정은 키가 없거나 loaded=false */
  details: Record<string, CourseDetail>;
  error: string | null;
  retry: () => void;
}

/**
 * idsKey: courseIdsKey()로 만든 "id1,id2" 문자열.
 * 문자열이 같으면 다시 구독하지 않으므로, 과정 순서만 바뀌었을 때 리스너를 새로 열지 않는다.
 */
export function useCoursesDetails(idsKey: string): CoursesDetailsState {
  const [details, setDetails] = useState<Record<string, CourseDetail>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const courseIds = idsKey.length > 0 ? idsKey.split(",") : [];
    const unsubscribe = subscribeCoursesDetails(
      courseIds,
      (next) => {
        setDetails(next);
        setError(null);
      },
      (caught) => setError(toUserMessage(caught)),
    );
    return unsubscribe;
  }, [idsKey, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { details, error, retry };
}
