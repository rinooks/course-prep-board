"use client";

// 고른 파일을 차례로 올리는 대기열. 카드 추가 칸과 카드 상세의 첨부 파일 영역이 같이 쓴다.
// - 한 번에 하나씩 올린다 (한꺼번에 올리면 느린 인터넷에서 모두가 같이 늦어진다).
// - 실패한 파일은 대기열에 남고 이유가 보인다. "다시 올리기"는 실패한 것만 다시 한다.
//   ①(Storage에 올리기)은 됐고 ②(목록 정보 저장)만 실패했으면 ②만 다시 한다.
// - 다 올린 파일은 대기열에서 빠진다 (실제 첨부 목록은 Firestore 구독으로 들어온다).
// - 화면을 떠나면 올리는 중인 파일을 멈춘다.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  discardUploadedCardFile,
  saveCardFileRecord,
  uploadCardFileObject,
  type UploadedCardFile,
} from "@/lib/data/cardFiles";
import { checkCardFile, fileSlotsLeft, tooManyFilesMessage } from "@/lib/domain/cardFiles";
import { toUserMessage } from "@/lib/domain/errors";
import { createId } from "@/lib/domain/ids";

export type UploadStatus = "waiting" | "uploading" | "saving" | "failed";

export interface UploadItem {
  key: string;
  /** 다듬은 파일 이름 */
  name: string;
  size: number;
  status: UploadStatus;
  /** 0~100 */
  percent: number;
  /** 실패 이유 (다음 할 일 포함) */
  error: string | null;
}

/** 화면에 보이지 않는 파일별 작업 정보 */
interface Entry {
  file: File;
  /** ①이 끝났으면 그 결과 */
  uploaded: UploadedCardFile | null;
  controller: AbortController | null;
}

export interface FileUploads {
  items: readonly UploadItem[];
  /** 올리거나 저장하는 중인 파일이 있는지 */
  busy: boolean;
  hasFailed: boolean;
  /**
   * 고른 파일을 대기열에 넣는다. existingCount: 카드에 이미 붙어 있는 파일 수.
   * 형식·크기·개수가 맞지 않아 넣지 않은 파일의 이유를 돌려준다.
   */
  add: (files: readonly File[], existingCount: number) => string[];
  /** 대기열에서 뺀다. 올리는 중이면 멈춘다 (저장 중인 파일은 뺄 수 없다) */
  remove: (key: string) => void;
  /** 기다리는 파일을 차례로 올린다. retryFailed면 실패한 것도 다시 한다. 대기열에 실패가 없으면 true */
  start: (courseId: string, cardId: string, options?: { retryFailed?: boolean }) => Promise<boolean>;
  /** 모두 비운다 (올리는 중인 것은 멈춘다) */
  clear: () => void;
}

export function useFileUploads(): FileUploads {
  const [items, setItems] = useState<readonly UploadItem[]>([]);
  // 이벤트·비동기 작업 안에서 최신 값을 바로 읽으려고 ref에도 둔다. 바꿀 때는 apply()로만 바꾼다
  const itemsRef = useRef<readonly UploadItem[]>([]);
  const entriesRef = useRef(new Map<string, Entry>());
  const runningRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(false);

  const apply = useCallback((change: (current: readonly UploadItem[]) => readonly UploadItem[]) => {
    itemsRef.current = change(itemsRef.current);
    if (mountedRef.current) setItems(itemsRef.current);
  }, []);

  const patch = useCallback(
    (key: string, changes: Partial<UploadItem>) => {
      apply((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
    },
    [apply],
  );

  const drop = useCallback(
    (key: string) => {
      entriesRef.current.delete(key);
      apply((current) => current.filter((item) => item.key !== key));
    },
    [apply],
  );

  useEffect(() => {
    mountedRef.current = true;
    const entries = entriesRef.current;
    return () => {
      // 화면을 떠나면 올리는 중인 파일을 멈춘다.
      // ①이 끝난 파일은 치우지 않는다: ②가 이미 진행 중일 수 있어, 치우면 목록에 열리지 않는 파일이 생긴다.
      mountedRef.current = false;
      for (const entry of entries.values()) entry.controller?.abort();
    };
  }, []);

  const add = useCallback(
    (files: readonly File[], existingCount: number): string[] => {
      const problems: string[] = [];
      const added: UploadItem[] = [];
      let slots = fileSlotsLeft(existingCount + itemsRef.current.length);
      let skipped = 0;

      for (const file of files) {
        const check = checkCardFile(file);
        if (!check.ok) {
          problems.push(check.message);
          continue;
        }
        const duplicate = Array.from(entriesRef.current.values()).some(
          (entry) =>
            entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified,
        );
        if (duplicate) {
          problems.push(`"${check.value.name}" 파일은 이미 올릴 목록에 있습니다.`);
          continue;
        }
        if (slots <= 0) {
          skipped += 1;
          continue;
        }
        slots -= 1;
        const key = createId();
        entriesRef.current.set(key, { file, uploaded: null, controller: null });
        added.push({ key, name: check.value.name, size: file.size, status: "waiting", percent: 0, error: null });
      }

      if (skipped > 0) problems.push(tooManyFilesMessage(skipped));
      if (added.length > 0) apply((current) => [...current, ...added]);
      return problems;
    },
    [apply],
  );

  const remove = useCallback(
    (key: string) => {
      const entry = entriesRef.current.get(key);
      const item = itemsRef.current.find((candidate) => candidate.key === key);
      if (!entry || item?.status === "saving") return;
      entry.controller?.abort();
      if (entry.uploaded) void discardUploadedCardFile(entry.uploaded);
      drop(key);
    },
    [drop],
  );

  const clear = useCallback(() => {
    for (const key of Array.from(entriesRef.current.keys())) remove(key);
  }, [remove]);

  /** 기다리는 파일이 없어질 때까지 하나씩 올린다 */
  const processQueue = useCallback(
    async (courseId: string, cardId: string) => {
      for (;;) {
        if (!mountedRef.current) return;
        const next = itemsRef.current.find((item) => item.status === "waiting");
        if (!next) return;
        const key = next.key;
        const entry = entriesRef.current.get(key);
        if (!entry) {
          drop(key);
          continue;
        }

        try {
          if (!entry.uploaded) {
            const controller = new AbortController();
            entry.controller = controller;
            patch(key, { status: "uploading", percent: 0, error: null });
            entry.uploaded = await uploadCardFileObject(courseId, cardId, entry.file, {
              signal: controller.signal,
              onProgress: (percent) => patch(key, { percent }),
            });
            entry.controller = null;
          }
          // 올리는 동안 사용자가 뺐으면 remove()가 이미 치웠다
          if (!entriesRef.current.has(key)) continue;
          patch(key, { status: "saving", percent: 100, error: null });
          await saveCardFileRecord(courseId, cardId, entry.uploaded);
          drop(key);
        } catch (error) {
          entry.controller = null;
          // 사용자가 빼서 멈춘 경우는 실패로 보여주지 않는다
          if (!entriesRef.current.has(key)) continue;
          patch(key, { status: "failed", error: toUserMessage(error) });
        }
      }
    },
    [drop, patch],
  );

  const start = useCallback(
    async (courseId: string, cardId: string, options: { retryFailed?: boolean } = {}): Promise<boolean> => {
      if (options.retryFailed) {
        apply((current) =>
          current.map((item) => (item.status === "failed" ? { ...item, status: "waiting", error: null } : item)),
        );
      }
      // 이미 돌고 있으면 그 작업이 새로 넣은 파일까지 올린다. 끝난 직후에 넣은 파일이 남지 않게 다시 확인한다
      for (;;) {
        if (!mountedRef.current) return false;
        if (runningRef.current) {
          await runningRef.current;
          continue;
        }
        if (!itemsRef.current.some((item) => item.status === "waiting")) break;
        runningRef.current = processQueue(courseId, cardId).finally(() => {
          runningRef.current = null;
        });
      }
      return !itemsRef.current.some((item) => item.status === "failed");
    },
    [apply, processQueue],
  );

  const busy = items.some((item) => item.status === "uploading" || item.status === "saving");
  const hasFailed = items.some((item) => item.status === "failed");

  return { items, busy, hasFailed, add, remove, start, clear };
}
