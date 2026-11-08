"use client";

// 앱 안 알림(내일 강의, 미입금 강사료)을 한 번만 구독해 머리글 종과 홈 화면에 같이 준다.
// app/layout.tsx에서 AuthProvider 안쪽에 한 번 감싸므로, 화면을 옮겨 다녀도 구독이 끊기지 않는다.
// 초대된 팀원으로 로그인했을 때만 구독하고, 로그아웃하면 모두 해제한다.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToday } from "@/components/home/useToday";
import type { Member } from "@/lib/data/types";
import { buildNotices, type Notice } from "@/lib/domain/notices";
import {
  openActiveCourses,
  openArchivedCourses,
  openFees,
  openMembers,
  openSessions,
  sourceKey,
} from "./noticeSources";
import { useKeyedSubscription } from "./useKeyedSubscription";

export interface NoticesContextValue {
  /** 팀원으로 로그인해 알림을 구독 중이면 true */
  active: boolean;
  notices: Notice[];
  /** 아직 받는 중인 자료가 있으면 true (받은 것만으로 만든 알림은 notices에 이미 들어 있다) */
  loading: boolean;
  /** 사용자에게 보여 줄 문구 (다음 할 일 포함) */
  error: string | null;
  /** 구독을 다시 연다 */
  retry: () => void;
}

const NO_NOTICES: Notice[] = [];
const NO_MEMBERS: Member[] = [];

const INACTIVE: NoticesContextValue = {
  active: false,
  notices: NO_NOTICES,
  loading: false,
  error: null,
  retry: () => {},
};

const NoticesContext = createContext<NoticesContextValue>(INACTIVE);

export function NoticesProvider({ children }: { children: ReactNode }) {
  const { status, email, isAdmin } = useAuth();
  const today = useToday();
  const [attempt, setAttempt] = useState(0);
  const signedIn = status === "member" && email !== null;
  const me = email ?? "";

  const active = useKeyedSubscription(signedIn ? sourceKey(attempt, "active", me) : null, openActiveCourses);
  const archived = useKeyedSubscription(signedIn ? sourceKey(attempt, "archived", me) : null, openArchivedCourses);
  const fees = useKeyedSubscription(
    signedIn ? sourceKey(attempt, "fees", me, isAdmin ? "admin" : "instructor") : null,
    openFees,
  );
  // 이름은 관리자가 다른 강사의 강사료를 볼 때만 필요하다
  const members = useKeyedSubscription(signedIn && isAdmin ? sourceKey(attempt, "members", me) : null, openMembers);

  // 회차는 내가 담당 강사인 진행 중 과정만 구독한다 (내일 강의 알림은 담당 강사에게만 간다)
  const myCourseIds = useMemo(() => {
    if (!active.data) return null;
    return active.data
      .filter((course) => course.instructorEmails.includes(me))
      .map((course) => course.id)
      .sort()
      .join(",");
  }, [active.data, me]);
  const sessions = useKeyedSubscription(
    signedIn && myCourseIds ? sourceKey(attempt, "sessions", me, myCourseIds) : null,
    openSessions,
  );

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const error = active.error ?? fees.error ?? archived.error ?? sessions.error ?? members.error;
  const activeCourses = active.data;
  const archivedCourses = archived.data;
  const feeList = fees.data;
  const memberList = members.data;
  const sessionsByCourse = sessions.data;

  const value = useMemo<NoticesContextValue>(() => {
    if (!signedIn) return INACTIVE;

    const sessionsReady = myCourseIds === "" || sessionsByCourse !== null;
    const ready =
      today !== null && activeCourses !== null && archivedCourses !== null && feeList !== null && sessionsReady;

    // 일부만 받았어도 받은 것으로 먼저 보여 준다 (예: 강사료 구독이 실패해도 내일 강의는 보인다)
    const notices =
      today !== null && activeCourses !== null
        ? buildNotices({
            email: me,
            isAdmin,
            today,
            courses: [...activeCourses, ...(archivedCourses ?? [])],
            sessionsByCourse: sessionsByCourse ?? {},
            fees: feeList ?? [],
            members: memberList ?? NO_MEMBERS,
          })
        : NO_NOTICES;

    return { active: true, notices, loading: !ready && error === null, error, retry };
  }, [
    signedIn,
    me,
    isAdmin,
    today,
    activeCourses,
    archivedCourses,
    feeList,
    memberList,
    sessionsByCourse,
    myCourseIds,
    error,
    retry,
  ]);

  return <NoticesContext.Provider value={value}>{children}</NoticesContext.Provider>;
}

/** 지금 로그인한 사람의 알림. NoticesProvider 밖에서는 빈 목록을 준다 */
export function useNotices(): NoticesContextValue {
  return useContext(NoticesContext);
}
