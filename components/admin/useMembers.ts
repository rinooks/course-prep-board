"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeMembers } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

const LOAD_FAILED_MESSAGE =
  "팀원 목록을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";

export interface MembersState {
  /** 아직 한 번도 받지 못했으면 null */
  members: Member[] | null;
  /** 구독 오류 문구. 목록을 이미 받았다면 목록은 그대로 두고 문구만 보여준다 */
  error: string | null;
  /** 구독을 다시 연다 */
  retry: () => void;
}

/** 팀원 전체를 실시간으로 받는다. 다른 관리자가 바꾼 내용도 새로고침 없이 반영된다. */
export function useMembers(): MembersState {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeMembers(
      (nextMembers) => {
        setMembers(nextMembers);
        setError(null);
      },
      (caught) => setError(toUserMessage(caught, LOAD_FAILED_MESSAGE)),
    );
    return unsubscribe;
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { members, error, retry };
}
