"use client";

// 실시간 구독 하나를 "key"로 관리한다. key가 바뀌면 이전 구독을 끊고 새로 연다.
// 받은 값에 key를 같이 적어 두어, 사용자가 바뀐 직후 이전 사람의 값이 잠깐이라도 보이지 않게 한다.

import { useEffect, useState } from "react";
import type { ErrorHandler, Unsubscribe } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";

/** key를 받아 구독을 열고 해제 함수를 돌려준다. 컴포넌트 밖에 만들어 두어 매번 새로 만들지 않는다 */
export type KeyedOpener<T> = (key: string, onData: (value: T) => void, onError: ErrorHandler) => Unsubscribe;

export interface KeyedSubscriptionState<T> {
  /** 아직 못 받았거나 key가 null이면 null */
  data: T | null;
  error: string | null;
}

interface Slot<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/** key가 null이면 구독하지 않는다 (로그인 전, 권한 없음 등) */
export function useKeyedSubscription<T>(key: string | null, open: KeyedOpener<T>): KeyedSubscriptionState<T> {
  const [slot, setSlot] = useState<Slot<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    return open(
      key,
      (data) => setSlot({ key, data, error: null }),
      (error) =>
        setSlot((previous) => ({
          key,
          // 이미 받은 값은 그대로 두고 문구만 보여 준다
          data: previous && previous.key === key ? previous.data : null,
          error: toUserMessage(error),
        })),
    );
  }, [key, open]);

  if (key === null || slot === null || slot.key !== key) return { data: null, error: null };
  return { data: slot.data, error: slot.error };
}
