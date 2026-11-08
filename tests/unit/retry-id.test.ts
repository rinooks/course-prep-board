import { describe, expect, it } from "vitest";
import { createRetryIdTracker } from "@/lib/domain/retryId";
import { createIdempotentRunner } from "@/lib/domain/async";

function counterIds() {
  let count = 0;
  return () => {
    count += 1;
    return `id-${count}`;
  };
}

describe("createRetryIdTracker", () => {
  it("같은 입력으로 다시 보내면 같은 id (중복 방지)", () => {
    const tracker = createRetryIdTracker(counterIds());
    expect(tracker.idFor("카드 A")).toBe("id-1");
    expect(tracker.idFor("카드 A")).toBe("id-1");
  });

  it("입력이 바뀌면 새 id", () => {
    const tracker = createRetryIdTracker(counterIds());
    expect(tracker.idFor("카드 A")).toBe("id-1");
    expect(tracker.idFor("카드 B")).toBe("id-2");
    expect(tracker.idFor("카드 B")).toBe("id-2");
  });

  it("성공 뒤 reset하면 같은 입력이어도 새 id", () => {
    const tracker = createRetryIdTracker(counterIds());
    expect(tracker.idFor("카드 A")).toBe("id-1");
    tracker.reset();
    expect(tracker.idFor("카드 A")).toBe("id-2");
  });

  it("시간 초과 뒤 입력을 바꿔 다시 보내면 새 입력이 실제로 저장된다", async () => {
    const tracker = createRetryIdTracker(counterIds());
    const runner = createIdempotentRunner();
    const saved: string[] = [];
    let finishFirst: () => void = () => {};

    const firstId = tracker.idFor("A");
    const first = runner.run(
      `card:create:${firstId}`,
      () =>
        new Promise<void>((resolve) => {
          finishFirst = () => {
            saved.push("A");
            resolve();
          };
        }),
      10,
    );
    await expect(first).rejects.toThrow();

    const secondId = tracker.idFor("B");
    expect(secondId).not.toBe(firstId);
    await runner.run(`card:create:${secondId}`, async () => {
      saved.push("B");
    });
    finishFirst();
    await Promise.resolve();
    expect(saved).toEqual(["B", "A"]);
  });
});
