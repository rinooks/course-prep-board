"use client";

import Link from "next/link";
import { useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type MouseEvent } from "react";
import { cn, focusRing, focusRingInverse } from "./cn";
import { Spinner } from "./Spinner";

/**
 * - solid: 화면에서 가장 중요한 버튼 하나 / outline: 나머지 / ghost: 목록 안의 가벼운 버튼
 * - danger: 확인 창의 "지우기"처럼 되돌리기 어려운 마지막 단계 / dangerGhost: 목록·창 안의 삭제·내보내기
 * - inverse·inverseOutline: 네이비 타일(PageHeader) 위의 버튼 (타일 안에서는 size="sm"만 쓴다)
 */
export type ButtonVariant = "solid" | "outline" | "ghost" | "danger" | "dangerGhost" | "inverse" | "inverseOutline";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  solid: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-line bg-white text-ink hover:bg-ink/5",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-danger text-primary-foreground hover:bg-danger/90",
  dangerGhost: "text-danger hover:bg-danger/5",
  inverse: "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
  inverseOutline:
    "border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10",
};

const INVERSE_VARIANTS: readonly ButtonVariant[] = ["inverse", "inverseOutline"];

// 두 크기 모두 터치 영역 최소 44px
const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 py-2.5 text-base",
  sm: "min-h-11 px-3 py-2 text-sm",
};

/** 버튼 모양 클래스. 링크를 버튼처럼 보이게 할 때도 쓴다. */
export function buttonClasses(
  variant: ButtonVariant = "solid",
  size: ButtonSize = "md",
  fullWidth = false,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-button font-semibold whitespace-nowrap",
    "transition active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
    INVERSE_VARIANTS.includes(variant) ? focusRingInverse : focusRing,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
  );
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** true면 스피너를 보이고 누를 수 없게 한다 */
  loading?: boolean;
  /** 로딩 중 화면 낭독기에 읽어 줄 문구 */
  loadingLabel?: string;
  /**
   * Promise를 돌려주면 끝날 때까지 자동으로 로딩 상태가 되고 다시 누를 수 없다 (두 번 전송 방지).
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}

export function Button({
  variant = "solid",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingLabel = "처리 중",
  type = "button",
  disabled,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const [pending, setPending] = useState(false);
  const busyRef = useRef(false);
  const busy = loading || pending;

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (busyRef.current || busy) {
      event.preventDefault();
      return;
    }
    const result = onClick?.(event);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      busyRef.current = true;
      setPending(true);
      try {
        await result;
      } catch {
        // 오류 표시는 onClick을 넘긴 쪽이 맡는다
      } finally {
        busyRef.current = false;
        setPending(false);
      }
    }
  }

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      onClick={handleClick}
      {...rest}
    >
      {busy ? <Spinner size="sm" label={loadingLabel} /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

/** 버튼처럼 보이는 링크 (페이지 이동용) */
export function ButtonLink({
  variant = "solid",
  size = "md",
  fullWidth = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return <Link className={cn(buttonClasses(variant, size, fullWidth), className)} {...rest} />;
}
