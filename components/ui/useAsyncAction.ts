"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fieldErrorsOf, toUserMessage } from "@/lib/domain/errors";
import type { FieldErrors } from "@/lib/domain/validation";

export type AsyncActionResult<Result> = { ok: true; value: Result } | { ok: false };

export interface AsyncActionState<Args extends unknown[], Result> {
  /**
   * 실행. 성공하면 { ok: true, value }, 실패하거나 이미 실행 중이면 { ok: false }.
   * 실패 문구는 error에 들어간다.
   */
  run: (...args: Args) => Promise<AsyncActionResult<Result>>;
  pending: boolean;
  /** 사용자에게 보여줄 문구 (다음 할 일 포함). 성공하면 null로 지워진다 */
  error: string | null;
  /** 입력값 검증 실패 시 칸별 메시지 */
  fieldErrors: FieldErrors;
  /** 오류 표시 지우기 (입력을 다시 고칠 때 등) */
  reset: () => void;
}

/**
 * 저장 버튼 같은 비동기 작업을 감싼다: 진행 중 표시, 중복 실행 막기, 오류 문구 변환.
 *
 * 예:
 *   const save = useAsyncAction((title: string) => updateCard(courseId, cardId, { title }));
 *   <Button loading={save.pending} onClick={async () => { if ((await save.run(title)).ok) close(); }}>저장</Button>
 *   {save.error && <Alert tone="error">{save.error}</Alert>}
 */
export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): AsyncActionState<Args, Result> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const busyRef = useRef(false);
  const actionRef = useRef(action);

  // 화면이 다시 그려질 때마다 최신 action을 기억해 둔다
  useEffect(() => {
    actionRef.current = action;
  });

  const run = useCallback(async (...args: Args): Promise<AsyncActionResult<Result>> => {
    if (busyRef.current) return { ok: false };
    busyRef.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const value = await actionRef.current(...args);
      return { ok: true, value };
    } catch (caught) {
      setError(toUserMessage(caught));
      setFieldErrors(fieldErrorsOf(caught));
      return { ok: false };
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return { run, pending, error, fieldErrors, reset };
}
