// "만들기" 저장에 쓸 문서 id를 고른다.
// - 같은 입력으로 다시 보내면 같은 id를 쓴다. 저장이 늦어 다시 눌러도 문서가 두 개 생기지 않는다.
// - 입력이 바뀌었으면 새 id를 쓴다. 같은 id를 쓰면 앞서 보낸 작업의 결과(옛 입력)가
//   그대로 돌아와, 바뀐 입력은 저장되지 않았는데 성공처럼 보이기 때문이다.

import { createId } from "./ids";

export interface RetryIdTracker {
  /** 지금 입력(signature: 입력값을 문자열로 만든 것)에 쓸 id */
  idFor(signature: string): string;
  /** 저장에 성공하면 부른다. 다음 저장은 새 id로 시작한다 */
  reset(): void;
}

export function createRetryIdTracker(makeId: () => string = createId): RetryIdTracker {
  let current: { id: string; signature: string } | null = null;

  return {
    idFor(signature: string): string {
      if (current === null || current.signature !== signature) {
        current = { id: makeId(), signature };
      }
      return current.id;
    },
    reset() {
      current = null;
    },
  };
}
