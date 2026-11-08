import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TimeoutError,
  createIdempotentRunner,
  createStallTimer,
  isTimeoutError,
  retryWithBackoff,
  withTimeout,
} from "@/lib/domain/async";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("withTimeout", () => {
  it("시간 안에 끝나면 결과를 그대로", async () => {
    const task = deferred<string>();
    const wrapped = withTimeout(task.promise, 1000);
    task.resolve("ok");
    await expect(wrapped).resolves.toBe("ok");
  });

  it("시간을 넘기면 TimeoutError", async () => {
    const task = deferred<string>();
    const wrapped = withTimeout(task.promise, 1000);
    const assertion = expect(wrapped).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("원래 오류는 그대로 전달하고 타이머를 치운다", async () => {
    const task = deferred<string>();
    const wrapped = withTimeout(task.promise, 1000);
    task.reject(new Error("원래 오류"));
    await expect(wrapped).rejects.toThrow("원래 오류");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("isTimeoutError", () => {
    expect(isTimeoutError(new TimeoutError(1))).toBe(true);
    expect(isTimeoutError(new Error("x"))).toBe(false);
  });
});

describe("retryWithBackoff", () => {
  it("1초 → 2초 → 4초 간격으로 다시 시도한다", async () => {
    const calls: number[] = [];
    const task = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length < 4) throw new Error("일시 오류");
      return "성공";
    });
    const start = Date.now();
    const result = retryWithBackoff(task, { retries: 3, baseDelayMs: 1000 });
    await vi.advanceTimersByTimeAsync(7000);
    await expect(result).resolves.toBe("성공");
    expect(calls.map((time) => time - start)).toEqual([0, 1000, 3000, 7000]);
  });

  it("횟수를 다 쓰면 마지막 오류로 실패", async () => {
    const task = vi.fn(async () => {
      throw new Error("계속 실패");
    });
    const result = retryWithBackoff(task, { retries: 2, baseDelayMs: 100 });
    const assertion = expect(result).rejects.toThrow("계속 실패");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("shouldRetry가 false면 바로 실패", async () => {
    const task = vi.fn(async () => {
      throw new Error("권한 없음");
    });
    await expect(retryWithBackoff(task, { shouldRetry: () => false })).rejects.toThrow("권한 없음");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("간격은 maxDelayMs를 넘지 않는다", async () => {
    const calls: number[] = [];
    const task = async () => {
      calls.push(Date.now());
      if (calls.length < 4) throw new Error("x");
      return 1;
    };
    const start = Date.now();
    const result = retryWithBackoff(task, { retries: 3, baseDelayMs: 1000, maxDelayMs: 1500 });
    await vi.advanceTimersByTimeAsync(5000);
    await result;
    expect(calls.map((time) => time - start)).toEqual([0, 1000, 2500, 4000]);
  });
});

describe("createIdempotentRunner", () => {
  it("진행 중인 같은 작업은 다시 실행하지 않는다", async () => {
    const runner = createIdempotentRunner();
    const task = deferred<string>();
    const fn = vi.fn(() => task.promise);
    const first = runner.run("k", fn, 10_000);
    const second = runner.run("k", fn, 10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(runner.isPending("k")).toBe(true);
    task.resolve("완료");
    await expect(first).resolves.toBe("완료");
    await expect(second).resolves.toBe("완료");
  });

  it("시간 초과 뒤 다시 시도하면 처음 작업을 계속 기다린다 (새로 보내지 않음)", async () => {
    const runner = createIdempotentRunner();
    const task = deferred<string>();
    const fn = vi.fn(() => task.promise);

    const first = runner.run("k", fn, 1000);
    const firstAssertion = expect(first).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await firstAssertion;

    const retry = runner.run("k", fn, 1000);
    task.resolve("늦게 저장됨");
    await expect(retry).resolves.toBe("늦게 저장됨");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("성공한 작업은 다시 실행하지 않고, 실패한 작업은 다시 실행한다", async () => {
    const runner = createIdempotentRunner();
    const ok = vi.fn(async () => "ok");
    await runner.run("a", ok);
    await expect(runner.run("a", ok)).resolves.toBe("ok");
    expect(ok).toHaveBeenCalledTimes(1);

    let attempt = 0;
    const flaky = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("첫 실패");
      return "두 번째 성공";
    });
    await expect(runner.run("b", flaky)).rejects.toThrow("첫 실패");
    await expect(runner.run("b", flaky)).resolves.toBe("두 번째 성공");
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it("기억하는 성공 작업 수에 한도가 있다", async () => {
    const runner = createIdempotentRunner(2);
    const fn = vi.fn(async () => 1);
    await runner.run("1", fn);
    await runner.run("2", fn);
    await runner.run("3", fn);
    await runner.run("1", fn); // 가장 오래된 "1"은 잊혀서 다시 실행된다
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe("createStallTimer (진행 없이 지난 시간 재기)", () => {
  it("진행이 계속 있으면 오래 걸려도 멈춤으로 보지 않는다", async () => {
    let stalled = 0;
    const timer = createStallTimer(30_000, () => (stalled += 1));
    for (let i = 0; i < 10; i += 1) {
      await vi.advanceTimersByTimeAsync(20_000);
      timer.touch();
    }
    expect(stalled).toBe(0);
    timer.stop();
  });

  it("마지막 진행 뒤 정해진 시간이 지나면 한 번 알린다", async () => {
    let stalled = 0;
    const timer = createStallTimer(30_000, () => (stalled += 1));
    await vi.advanceTimersByTimeAsync(10_000);
    timer.touch();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(stalled).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(stalled).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(stalled).toBe(1);
  });

  it("stop() 뒤에는 알리지 않는다 (타이머가 남지 않는다)", async () => {
    let stalled = 0;
    const timer = createStallTimer(30_000, () => (stalled += 1));
    timer.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(stalled).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
