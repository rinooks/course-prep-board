"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

export type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface ToastOptions {
  tone?: ToastTone;
  /** 자동으로 사라지기까지 시간. 기본: 오류 8초, 그 밖 4초 */
  durationMs?: number;
}

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_TOASTS = 3;

const TONES: Record<ToastTone, string> = {
  success: "border-success/25 bg-white text-success",
  error: "border-danger/25 bg-white text-danger",
  info: "border-line bg-white text-ink",
};

/** 화면 아래쪽에 잠깐 뜨는 알림. app/layout.tsx에서 한 번 감싼다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const tone = options.tone ?? "info";
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, message, tone }].slice(-MAX_TOASTS));
      const duration = options.durationMs ?? (tone === "error" ? 8000 : 4000);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  // 화면을 떠날 때 남은 타이머를 모두 치운다
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, { tone: "success" }),
      error: (message) => show(message, { tone: "error" }),
      info: (message) => show(message, { tone: "info" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-4 md:items-end md:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border p-4 text-sm shadow-card",
              "animate-pop-in motion-reduce:animate-none",
              TONES[toast.tone],
            )}
          >
            <p className="flex-1 leading-relaxed">{toast.message}</p>
            {/* -m-2: 44px 누르는 영역은 지키면서 알림 상자의 모서리 여백에 맞춘다 */}
            <IconButton
              label="알림 닫기"
              icon={<CloseIcon className="h-4 w-4" />}
              onClick={() => dismiss(toast.id)}
              className="-m-2"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast는 ToastProvider 안에서만 쓸 수 있습니다 (app/layout.tsx 확인).");
  }
  return api;
}
