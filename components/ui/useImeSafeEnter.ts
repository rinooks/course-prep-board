"use client";

import { useCallback, type KeyboardEvent } from "react";
import { isSubmitEnter } from "./ime";

/**
 * Enter로 전송하는 입력칸에 붙이는 onKeyDown.
 * 한글 조합 중 Enter와 Shift+Enter(줄바꿈)는 무시한다.
 *
 * 예: <Input onKeyDown={useImeSafeEnter(() => add())} />
 */
export function useImeSafeEnter<T extends HTMLElement = HTMLInputElement>(
  onEnter: () => void,
): (event: KeyboardEvent<T>) => void {
  return useCallback(
    (event: KeyboardEvent<T>) => {
      if (!isSubmitEnter(event)) return;
      event.preventDefault();
      onEnter();
    },
    [onEnter],
  );
}
