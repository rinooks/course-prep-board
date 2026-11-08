// 실시간 구독 도우미의 오프라인 처리: 캐시에서 온 "없음"을 확정하지 않는지
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (snapshot: unknown) => void;

const firestoreMock = vi.hoisted(() => {
  const state: { listener: Listener | null; unsubscribed: number } = { listener: null, unsubscribed: 0 };
  return {
    state,
    onSnapshot: (_target: unknown, _options: unknown, next: Listener) => {
      state.listener = next;
      return () => {
        state.unsubscribed += 1;
      };
    },
  };
});

vi.mock("firebase/firestore", () => ({ onSnapshot: firestoreMock.onSnapshot }));

import { listenDoc, listenQuery, OFFLINE_NOTICE_DELAY_MS } from "@/lib/data/listen";

function docSnapshot(exists: boolean, fromCache: boolean) {
  return { exists: () => exists, metadata: { fromCache, hasPendingWrites: false }, id: "doc-1" };
}

function querySnapshot(ids: string[], fromCache: boolean) {
  return {
    empty: ids.length === 0,
    docs: ids.map((id) => ({ id })),
    metadata: { fromCache, hasPendingWrites: false },
  };
}

function emit(snapshot: unknown) {
  if (!firestoreMock.state.listener) throw new Error("구독이 열리지 않았습니다");
  firestoreMock.state.listener(snapshot);
}

beforeEach(() => {
  vi.useFakeTimers();
  firestoreMock.state.listener = null;
  firestoreMock.state.unsubscribed = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listenDoc", () => {
  it("캐시에서 온 '문서 없음'은 바로 넘기지 않고, 서버 확인을 기다린다", () => {
    const onData = vi.fn();
    const onError = vi.fn();
    listenDoc(() => ({}) as never, (snapshot) => snapshot.id, onData, onError);

    emit(docSnapshot(false, true));
    expect(onData).not.toHaveBeenCalled();

    emit(docSnapshot(true, false));
    expect(onData).toHaveBeenCalledWith("doc-1");
    vi.advanceTimersByTime(OFFLINE_NOTICE_DELAY_MS * 2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("서버 확인이 계속 없으면 인터넷 연결 안내를 보낸다", () => {
    const onData = vi.fn();
    const onError = vi.fn();
    listenDoc(() => ({}) as never, (snapshot) => snapshot.id, onData, onError);

    emit(docSnapshot(false, true));
    vi.advanceTimersByTime(OFFLINE_NOTICE_DELAY_MS);
    expect(onData).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0].message)).toContain("인터넷");
  });

  it("서버가 확인한 '문서 없음'은 null로 넘긴다", () => {
    const onData = vi.fn();
    listenDoc(() => ({}) as never, (snapshot) => snapshot.id, onData, vi.fn());
    emit(docSnapshot(false, false));
    expect(onData).toHaveBeenCalledWith(null);
  });

  it("첫 데이터를 넘긴 뒤에는 캐시 결과도 그대로 넘긴다 (오프라인에서 지운 결과 등)", () => {
    const onData = vi.fn();
    listenDoc(() => ({}) as never, (snapshot) => snapshot.id, onData, vi.fn());
    emit(docSnapshot(true, false));
    emit(docSnapshot(false, true));
    expect(onData).toHaveBeenLastCalledWith(null);
  });

  it("구독을 끊으면 기다리던 안내 타이머도 치운다", () => {
    const onError = vi.fn();
    const unsubscribe = listenDoc(() => ({}) as never, (snapshot) => snapshot.id, vi.fn(), onError);
    emit(docSnapshot(false, true));
    unsubscribe();
    vi.advanceTimersByTime(OFFLINE_NOTICE_DELAY_MS * 2);
    expect(onError).not.toHaveBeenCalled();
    expect(firestoreMock.state.unsubscribed).toBe(1);
  });
});

describe("listenQuery", () => {
  it("캐시에서 온 빈 목록은 기다리고, 캐시에 있는 항목은 바로 넘긴다", () => {
    const onData = vi.fn();
    const onError = vi.fn();
    listenQuery(() => ({}) as never, (snapshot) => snapshot.id, onData, onError);

    emit(querySnapshot([], true));
    expect(onData).not.toHaveBeenCalled();

    emit(querySnapshot(["a"], true));
    expect(onData).toHaveBeenCalledWith(["a"]);
    vi.advanceTimersByTime(OFFLINE_NOTICE_DELAY_MS * 2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("서버가 확인한 빈 목록은 그대로 넘긴다", () => {
    const onData = vi.fn();
    listenQuery(() => ({}) as never, (snapshot) => snapshot.id, onData, vi.fn());
    emit(querySnapshot([], false));
    expect(onData).toHaveBeenCalledWith([]);
  });
});
