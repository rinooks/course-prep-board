import type { InputHTMLAttributes, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

// 입력칸 공통 모양: 높이 44px 이상, 포커스 링, 오류 시 빨간 테두리
const BASE =
  "w-full rounded-card border bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";

function borderFor(invalid?: boolean) {
  return invalid ? "border-danger" : "border-line";
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** true면 빨간 테두리 + aria-invalid */
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(BASE, "min-h-11", borderFor(invalid), className)}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ invalid, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(BASE, "leading-relaxed", borderFor(invalid), className)}
      {...rest}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** options를 주면 그것으로 그린다. 직접 <option>을 children으로 넣어도 된다 */
  options?: readonly SelectOption[];
  /** 맨 위 빈 선택지 문구 (예: "담당자 없음") */
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({ invalid, options, placeholder, className, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(BASE, "min-h-11 pr-8", borderFor(invalid), className)}
      {...rest}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );
}
