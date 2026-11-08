import Link from "next/link";
import type { ComponentProps, LabelHTMLAttributes, ReactNode } from "react";
import { cn, focusRing } from "./cn";

// 눌러서 이동하거나 고르는 목록 한 줄 (design.md 4장 "부품 규칙").
// 높이 44px 이상, 마우스를 올리면 옅은 회색. 목록을 카드 안쪽 여백까지 넓히려면 목록에 -mx-3을 준다.

/** 목록 한 줄 공통 모양. 버튼·라벨 등 다른 요소에 직접 붙일 때 쓴다 */
export const rowClass =
  "flex min-h-11 flex-col justify-center gap-0.5 rounded-card px-3 py-2 text-left transition hover:bg-ink/5 motion-reduce:transition-none";

type RowLinkProps = ComponentProps<typeof Link> & { className?: string };

/** 다른 화면으로 가는 목록 한 줄 */
export function RowLink({ className, ...rest }: RowLinkProps) {
  return <Link className={cn(rowClass, focusRing, className)} {...rest} />;
}

interface CheckboxRowProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 굵은 첫 줄 */
  label: ReactNode;
  /** 작은 둘째 줄 (이메일 등) */
  description?: ReactNode;
  /** true면 테두리 있는 칸 모양 (여러 개를 격자로 고를 때) */
  boxed?: boolean;
}

/** 체크박스 한 줄. 줄 전체를 눌러도 체크된다 */
export function CheckboxRow({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  boxed = false,
  className,
  ...rest
}: CheckboxRowProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-card px-3 py-2 transition motion-reduce:transition-none",
        boxed && "border",
        boxed && (checked ? "border-primary bg-primary/5" : "border-line bg-white"),
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-ink/5",
        className,
      )}
      {...rest}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={cn("size-5 shrink-0 rounded-button accent-primary", focusRing)}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
