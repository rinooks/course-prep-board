"use client";

// 실시간 구독 하나를 화면 상태로 바꾸는 훅.
// - 화면이 사라지거나 key가 바뀌면 구독을 끊는다 (useEffect cleanup).
// - 오류가 나면 문구를 돌려주고, retry()로 구독을 다시 연다. 이미 받은 데이터는 그대로 보여준다.

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/lib/domain/errors";
import type { ErrorHandler, Unsubscribe } from "@/lib/data/types";

export type SubscribeFn<T> = (onData: (value: T) => void, onError: ErrorHandler) => Unsubscribe;

export interface LiveValue<T> {
  value: T;
  /** 첫 데이터를 받았는지 */
  loaded: boolean;
  /** 사용자에게 보여줄 오류 문구 (다음 할 일 포함) */
  error: string | null;
  /** 구독 다시 열기 */
  retry: () => void;
}

interface Snapshot<T> {
  key: string;
  attempt: number;
  hasValue: boolean;
  value: T | undefined;
  error: string | null;
}

const LOAD_FAILED = "데이터를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 '다시 시도'를 눌러 주세요.";

/**
 * @param key 구독 대상이 바뀌면 달라지는 값. null이면 구독하지 않는다.
 * @param subscribe 구독 함수. 매번 새로 만들어도 된다 (key가 바뀔 때만 다시 구독한다).
 * @param fallback 첫 데이터를 받기 전 값. 매번 같은 값(모듈 상수)을 넘긴다.
 */
export function useLiveSubscription<T>(
  key: string | null,
  subscribe: SubscribeFn<T>,
  fallback: T,
): LiveValue<T> {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const subscribeRef = useRef(subscribe);

  // 최신 구독 함수를 기억해 둔다 (아래 effect보다 먼저 실행된다)
  useEffect(() => {
    subscribeRef.current = subscribe;
  });

  useEffect(() => {
    if (key === null) return;
    const unsubscribe = subscribeRef.current(
      (value) => {
        setSnapshot({ key, attempt, hasValue: true, value, error: null });
      },
      (error) => {
        setSnapshot((previous) => {
          const keep = previous !== null && previous.key === key;
          return {
            key,
            attempt,
            hasValue: keep ? previous.hasValue : false,
            value: keep ? previous.value : undefined,
            error: toUserMessage(error, LOAD_FAILED),
          };
        });
      },
    );
    return unsubscribe;
  }, [key, attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const current = snapshot !== null && snapshot.key === key ? snapshot : null;
  const loaded = current !== null && current.hasValue;
  return {
    value: loaded ? (current.value as T) : fallback,
    loaded,
    // 다시 시도를 누르면 이전 오류는 감춘다
    error: current !== null && current.attempt === attempt ? current.error : null,
    retry,
  };
}
