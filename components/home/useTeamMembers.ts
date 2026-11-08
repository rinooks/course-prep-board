"use client";

// 팀원 목록 실시간 구독. 담당 강사 이름 표시(홈·보관함)와 담당 강사 고르기(과정 만들기)에 쓴다.

import { useCallback, useEffect, useState } from "react";
import { subscribeMembers } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

export interface TeamMembersState {
  /** 아직 한 번도 못 받았으면 null */
  members: Member[] | null;
  error: string | null;
  retry: () => void;
}

export function useTeamMembers(): TeamMembersState {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeMembers(
      (list) => {
        setMembers(list);
        setError(null);
      },
      (caught) => setError(toUserMessage(caught)),
    );
    return unsubscribe;
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { members, error, retry };
}
