// 비동기 작업 도우미: 시간 제한, 점점 늘어나는 재시도, 같은 작업 중복 실행 막기.

/** Firestore 쓰기 시간 제한. 오프라인이면 쓰기 약속(Promise)이 끝나지 않으므로 반드시 건다. */
export const WRITE_TIMEOUT_MS = 10_000;
/** 한 번 읽기(getDoc 등) 시간 제한 */
export const READ_TIMEOUT_MS = 15_000;

export class TimeoutError extends Error {
  readonly code = "timeout";

  constructor(ms: number) {
    super(`작업이 ${ms}ms 안에 끝나지 않았습니다.`);
    this.name = "TimeoutError";
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * promise가 ms 안에 끝나지 않으면 TimeoutError로 실패시킨다.
 * 주의: 원래 작업을 취소하지는 않는다. Firestore 쓰기는 연결이 돌아오면 뒤늦게 저장될 수 있다.
 * 그래서 다시 시도해도 안전하도록 문서 id를 미리 만들어 같은 id로 쓴다.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number = WRITE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface StallTimer {
  /** 진행이 있었을 때 부른다 (기다리는 시간을 처음부터 다시 센다) */
  touch(): void;
  /** 작업이 끝났을 때 꼭 부른다 (타이머를 치운다) */
  stop(): void;
}

/**
 * 오래 걸리는 작업(파일 올리기)용 시간 제한. 전체 시간이 아니라 "진행 없이 지난 시간"을 잰다.
 * 큰 파일은 몇 분이 걸려도 정상이지만, ms 동안 진행이 전혀 없으면 연결이 끊긴 것으로 보고 onStall을 부른다.
 */
export function createStallTimer(ms: number, onStall: () => void): StallTimer {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function start() {
    clear();
    timer = setTimeout(() => {
      timer = null;
      onStall();
    }, ms);
  }

  start();
  return { touch: start, stop: clear };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  /** 처음 시도 뒤 다시 시도할 횟수 */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** false를 돌려주면 더 시도하지 않고 바로 실패한다 (예: 권한 오류) */
  shouldRetry?: (error: unknown) => boolean;
}

/** 실패하면 1초 → 2초 → 4초 … 간격을 늘려 가며 다시 시도한다. */
export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 1000, maxDelayMs = 8000, shouldRetry = () => true } = options;
  let attempt = 0;
  for (;;) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      attempt += 1;
      await sleep(delay);
    }
  }
}

export interface IdempotentRunner {
  /**
   * 같은 key의 작업이 아직 진행 중이면 새로 실행하지 않고 그 결과를 기다린다.
   * 이미 성공한 key면 다시 실행하지 않고 그때 결과를 돌려준다. 실패한 key는 다시 실행한다.
   * 기다림에는 timeoutMs 시간 제한이 걸린다 (원래 작업은 계속 진행된다).
   */
  run<T>(key: string, task: () => Promise<T>, timeoutMs?: number): Promise<T>;
  /** 진행 중인 작업이 있는지 (테스트·디버깅용) */
  isPending(key: string): boolean;
}

export function createIdempotentRunner(maxRemembered = 200): IdempotentRunner {
  const pending = new Map<string, Promise<unknown>>();
  const completed = new Map<string, unknown>();

  function remember(key: string, value: unknown) {
    completed.set(key, value);
    if (completed.size > maxRemembered) {
      const oldest = completed.keys().next().value;
      if (oldest !== undefined) completed.delete(oldest);
    }
  }

  return {
    run<T>(key: string, task: () => Promise<T>, timeoutMs: number = WRITE_TIMEOUT_MS): Promise<T> {
      if (completed.has(key)) {
        return Promise.resolve(completed.get(key) as T);
      }
      let operation = pending.get(key) as Promise<T> | undefined;
      if (!operation) {
        operation = task();
        pending.set(key, operation);
        operation.then(
          (value) => {
            pending.delete(key);
            remember(key, value);
          },
          () => {
            pending.delete(key);
          },
        );
      }
      return withTimeout(operation, timeoutMs);
    },
    isPending(key: string) {
      return pending.has(key);
    },
  };
}
