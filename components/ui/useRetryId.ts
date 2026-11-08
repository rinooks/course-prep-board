"use client";

import { useState } from "react";
import { createRetryIdTracker, type RetryIdTracker } from "@/lib/domain/retryId";

/**
 * "만들기" 폼에서 다시 시도할 때 쓸 문서 id.
 * 같은 입력이면 같은 id(중복 방지), 입력이 바뀌면 새 id(바뀐 입력이 묻히지 않게).
 *
 * 예:
 *   const retryIds = useRetryId();
 *   const id = retryIds.idFor(title);
 *   if ((await add.run(title, id)).ok) retryIds.reset();
 */
export function useRetryId(): RetryIdTracker {
  const [tracker] = useState(() => createRetryIdTracker());
  return tracker;
}
