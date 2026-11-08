"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, focusRing } from "./cn";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** 화면 낭독기가 읽는 이름. 글자 없는 버튼이라 꼭 넣는다 */
  label: string;
  /** components/ui/icons.tsx의 아이콘 */
  icon: ReactNode;
  /** danger: 마우스를 올리면 빨강 (삭제 등) */
  tone?: "default" | "danger";
}

/** 글자 없이 아이콘만 있는 버튼. 44×44px (design.md 7장 터치 영역) */
export function IconButton({ label, icon, tone = "default", type = "button", className, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-button text-muted transition motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger" ? "hover:bg-danger/5 hover:text-danger" : "hover:bg-ink/5 hover:text-ink",
        focusRing,
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
