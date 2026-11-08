"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

// 겹쳐 열린 창 중 맨 위 창만 Esc·Tab을 처리한다
const openStack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeNothing() {
  return () => {};
}

/** 브라우저에서만 true (서버 렌더링과 화면이 어긋나지 않게) */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

export interface ModalProps {
  open: boolean;
  /** Esc, 바깥 클릭, 닫기 버튼에서 부른다 */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** 아래쪽 버튼 줄 */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** false면 바깥(어두운 배경)을 눌러도 닫히지 않는다. 입력 중인 폼에 쓴다. 기본 true */
  closeOnBackdrop?: boolean;
  /** 열릴 때 먼저 포커스할 요소. 없으면 창 안 첫 입력칸·버튼 */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
}

const SIZES = {
  sm: "md:max-w-md",
  md: "md:max-w-xl",
  lg: "md:max-w-3xl",
} as const;

/**
 * 접근성 갖춘 대화 상자: role=dialog, aria-modal, Esc로 닫기,
 * 열리면 창 안으로 포커스 이동·Tab 순환, 닫히면 원래 자리로 포커스 복귀.
 * 휴대폰에서는 화면 아래에서 올라오는 모양, PC에서는 가운데.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  closeOnBackdrop = true,
  initialFocusRef,
  children,
}: ModalProps) {
  const isClient = useIsClient();
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    openStack.push(id);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTarget =
      initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const index = openStack.lastIndexOf(id);
      if (index >= 0) openStack.splice(index, 1);
      if (openStack.length === 0) document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, id, initialFocusRef]);

  if (!open || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/40"
        onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col rounded-t-tile bg-white shadow-lg md:rounded-tile",
          "animate-pop-in motion-reduce:animate-none focus:outline-none",
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-bold tracking-tight text-ink text-balance">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {/* -mr-2: 아이콘이 제목 오른쪽 여백 끝에 맞게 버튼 안쪽 여백만큼 당긴다 */}
          <IconButton label="닫기" icon={<CloseIcon />} onClick={() => onCloseRef.current()} className="-mr-2" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 md:flex-row md:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
