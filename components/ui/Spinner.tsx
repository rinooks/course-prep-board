import { cn } from "./cn";

interface SpinnerProps {
  /** 화면 낭독기용 설명 */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

/** 도는 동그라미. 움직임 줄이기 설정이면 멈춘 채로 보인다. */
export function Spinner({ label = "불러오는 중", size = "md", className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent motion-reduce:animate-none",
          SIZES[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface LoadingBlockProps {
  label?: string;
  /** true면 화면 높이를 꽉 채워 가운데에 둔다 */
  fullScreen?: boolean;
}

interface InlineLoadingProps {
  label?: string;
  className?: string;
}

/** 패널·칸 안에서 쓰는 한 줄짜리 "불러오는 중" (스피너 + 글자) */
export function InlineLoading({ label = "불러오는 중입니다…", className }: InlineLoadingProps) {
  return (
    <div className={cn("flex min-h-11 items-center gap-2 text-sm text-muted", className)}>
      <Spinner size="sm" label={label} className="text-primary" />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

/** 가운데 정렬된 스피너 + 글자 (구역 하나 또는 화면 전체를 기다릴 때) */
export function LoadingBlock({ label = "불러오는 중입니다…", fullScreen = false }: LoadingBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted",
        fullScreen && "min-h-dvh",
      )}
    >
      <Spinner size="lg" label={label} className="text-primary" />
      <p className="text-sm" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
