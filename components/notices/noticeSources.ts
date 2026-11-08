"use client";

// 알림에 필요한 실시간 구독들 (useKeyedSubscription에 넘기는 여는 함수).
// key는 JSON 배열 문자열이다: [다시 시도 번호, 누구의 것인지, 조건…]. key가 바뀌면 구독을 새로 연다.

import { subscribeCourses } from "@/lib/data/courses";
import { subscribeFees } from "@/lib/data/fees";
import { subscribeMembers } from "@/lib/data/members";
import { subscribeSessions } from "@/lib/data/sessions";
import type { Course, Fee, Member, Session } from "@/lib/data/types";
import type { KeyedOpener } from "./useKeyedSubscription";

export function sourceKey(...parts: Array<string | number | boolean>): string {
  return JSON.stringify(parts);
}

function keyParts(key: string): unknown[] {
  const parsed: unknown = JSON.parse(key);
  return Array.isArray(parsed) ? parsed : [];
}

/** 진행 중 과정 (휴지통 제외) */
export const openActiveCourses: KeyedOpener<Course[]> = (_key, onData, onError) =>
  subscribeCourses("active", onData, onError);

/** 보관한 과정. 보관한 과정의 미입금 강사료에 과정 이름을 붙이려고 받는다 */
export const openArchivedCourses: KeyedOpener<Course[]> = (_key, onData, onError) =>
  subscribeCourses("archived", onData, onError);

/** 팀원 (관리자 화면에서 강사 이름 표시용) */
export const openMembers: KeyedOpener<Member[]> = (_key, onData, onError) => subscribeMembers(onData, onError);

/** key: [시도, "fees", 이메일, "admin"|"instructor"]. 강사는 보안 규칙상 자기 것만 구독해야 한다 */
export const openFees: KeyedOpener<Fee[]> = (key, onData, onError) => {
  const [, , email, role] = keyParts(key);
  return subscribeFees({ email: String(email), isAdmin: role === "admin" }, onData, onError);
};

/** key: [시도, "sessions", 이메일, "과정id1,과정id2"]. 과정마다 회차를 구독해 과정 id → 회차로 모아 준다 */
export const openSessions: KeyedOpener<Record<string, Session[]>> = (key, onData, onError) => {
  const [, , , joinedIds] = keyParts(key);
  const courseIds = String(joinedIds ?? "")
    .split(",")
    .filter((id) => id.length > 0);
  const byCourse: Record<string, Session[]> = {};
  const unsubscribers = courseIds.map((courseId) =>
    subscribeSessions(
      courseId,
      (sessions) => {
        byCourse[courseId] = sessions;
        onData({ ...byCourse });
      },
      onError,
    ),
  );
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
};
