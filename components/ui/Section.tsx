import { useId, type ReactNode } from "react";
import { tileClass } from "./Card";
import { cn } from "./cn";

// 구역 제목 (design.md 4장 "부품 규칙"). 화면마다 제목 모양이 달라지지 않게 제목은 모두 이것으로 그린다.
// - h2: 페이지 안 큰 구역 (text-xl)
// - h3: 카드·패널 안 작은 구역 (text-base)

const HEADING_CLASS = {
  h2: "text-xl font-bold tracking-tight text-ink text-balance",
  h3: "text-base font-bold tracking-tight text-ink",
} as const;

interface SectionHeadingProps {
  as?: "h2" | "h3";
  id?: string;
  children: ReactNode;
  /** 제목 옆 작은 글자: 개수("3개"), 정렬 기준 등 */
  meta?: ReactNode;
  /** 제목 아래 한두 줄 설명 */
  description?: ReactNode;
  /** 오른쪽(휴대폰은 아래) 버튼 */
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({ as = "h2", id, children, meta, description, action, className }: SectionHeadingProps) {
  const Heading = as;
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading id={id} className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", HEADING_CLASS[as])}>
          <span>{children}</span>
          {meta !== undefined && meta !== null ? (
            <span className="text-sm font-semibold tracking-normal text-muted tabular-nums">{meta}</span>
          ) : null}
        </Heading>
        {description ? <div className="max-w-prose text-sm leading-relaxed text-muted">{description}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

interface SectionProps extends Omit<SectionHeadingProps, "id" | "className"> {
  title: ReactNode;
  className?: string;
  /** 바깥에서 이 구역으로 옮겨 올 때 쓰는 id (요약 칸 바로가기 등) */
  id?: string;
  /** 바로가기 대상이면 true: 초점을 받을 수 있게 하고 머리글에 가리지 않게 띄운다 */
  jumpTarget?: boolean;
  /** true면 제목을 화면에서 숨기고 화면 낭독기로만 읽게 한다. 내용이 타일 묶음이라 제목 줄 없이 격자에 맞출 때 쓴다 */
  hideHeading?: boolean;
  /** true면 제목까지 포함해 구역 전체를 타일 하나로 그린다. 안에는 Card를 다시 넣지 않고 flat 상자만 쓴다 */
  tile?: boolean;
}

/** 제목 + 내용 묶음. 제목과 내용 사이는 항상 gap-3이다. */
export function Section({
  title,
  as = "h2",
  meta,
  description,
  action,
  className,
  id,
  jumpTarget,
  hideHeading,
  tile,
  children,
}: SectionProps) {
  const headingId = useId();
  return (
    <section
      id={id}
      tabIndex={jumpTarget ? -1 : undefined}
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3",
        tile && cn(tileClass, "h-full"),
        jumpTarget && "scroll-mt-20 focus:outline-none",
        className,
      )}
    >
      <SectionHeading
        as={as}
        id={headingId}
        meta={meta}
        description={description}
        action={action}
        className={hideHeading ? "sr-only" : undefined}
      >
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}
