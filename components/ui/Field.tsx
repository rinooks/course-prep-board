import type { ReactNode } from "react";
import { cn } from "./cn";

/** Field가 만드는 오류 문구 id. 입력칸의 aria-describedby에 넣는다. */
export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

/** Field가 만드는 도움말 id */
export function fieldHintId(id: string): string {
  return `${id}-hint`;
}

/**
 * 입력칸의 aria-describedby 값. 오류·도움말이 있을 때만 id를 넣는다.
 * 예: <Input id="title" aria-describedby={describedBy("title", { error, hint })} />
 */
export function describedBy(
  id: string,
  options: { error?: string | null; hint?: ReactNode },
): string | undefined {
  const ids = [options.hint ? fieldHintId(id) : null, options.error ? fieldErrorId(id) : null].filter(
    Boolean,
  );
  return ids.length > 0 ? ids.join(" ") : undefined;
}

interface LabelProps {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function Label({ htmlFor, children, required, className }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-semibold text-ink", className)}>
      {children}
      {required ? (
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

/** 칸 아래 빨간 안내 문구 (화면 낭독기가 바로 읽는다) */
export function FieldError({ id, children }: { id: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={fieldErrorId(id)} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

interface FieldProps {
  /** 안에 넣는 입력칸의 id와 같아야 한다 */
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * 라벨 + 입력칸 + 도움말 + 오류 묶음.
 * 예:
 *   <Field id="title" label="과정 이름" required error={errors.title}>
 *     <Input id="title" invalid={!!errors.title} aria-describedby={describedBy("title", { error: errors.title })} />
 *   </Field>
 */
export function Field({ id, label, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {hint ? (
        <p id={fieldHintId(id)} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <FieldError id={id}>{error}</FieldError>
    </div>
  );
}
