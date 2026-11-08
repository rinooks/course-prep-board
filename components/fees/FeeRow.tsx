"use client";

// 강사료 목록 한 줄: 항목 이름, 상태 배지, 금액, 날짜, (관리자) 받는 강사, 메모, 버튼.
// 과정 탭은 고치기·지우기까지, 강사료 화면(/fees)은 과정 이름 링크와 입금 확인·취소만 넘긴다.

import Link from "next/link";
import { CourseDot } from "@/components/course/CourseDot";
import { courseTabHref } from "@/components/course/CourseTabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, focusRing } from "@/components/ui/cn";
import { CheckIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useToast } from "@/components/ui/Toast";
import { setFeePaid } from "@/lib/data/fees";
import type { Fee } from "@/lib/data/types";
import { formatDateKo, type DateString } from "@/lib/domain/dates";
import { formatWon } from "@/lib/domain/fees";
import { feeBadge, feeDatesText, feeTitle } from "./feeDisplay";

/** 강사료 화면에서 줄 맨 위에 보여 줄 과정 정보 */
export type FeeRowCourse =
  | { kind: "found"; id: string; title: string; client: string }
  | { kind: "loading" }
  /** 과정 목록을 불러오지 못함 (화면 위에 다시 시도 안내가 따로 뜬다) */
  | { kind: "unavailable" }
  | { kind: "missing" };

interface FeeRowProps {
  fee: Fee;
  today: DateString;
  /** 받는 강사 이름. 관리자에게만 넘긴다 (강사는 자기 것만 보므로 필요 없다) */
  instructorLabel?: string | null;
  /** 강사료 화면(/fees)에서만: 과정 이름과 고객사 */
  course?: FeeRowCourse;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FeeRow({ fee, today, instructorLabel, course, onEdit, onDelete }: FeeRowProps) {
  const badge = feeBadge(fee, today);
  const title = feeTitle(fee);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      {course ? <CourseLine course={course} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-ink">{title}</p>
          <Badge tone={badge.tone}>{badge.text}</Badge>
        </div>
        <p
          className={cn(
            "text-lg font-bold tracking-tight tabular-nums",
            badge.status === "overdue" ? "text-danger" : "text-ink",
          )}
        >
          {formatWon(fee.amount)}
        </p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted">
            {instructorLabel ? `${instructorLabel} · ` : ""}
            {feeDatesText(fee, today)}
          </p>
          {fee.memo ? <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{fee.memo}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 md:justify-end">
          <PaidToggle fee={fee} title={title} today={today} />
          {onEdit ? (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <PencilIcon />
              고치기
              <span className="sr-only">(‘{title}’ 강사료)</span>
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="dangerGhost" size="sm" onClick={onDelete}>
              <TrashIcon />
              지우기
              <span className="sr-only">(‘{title}’ 강사료)</span>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** 과정 이름(누르면 그 과정의 강사료 탭) · 고객사 */
function CourseLine({ course }: { course: FeeRowCourse }) {
  if (course.kind === "loading") {
    return <p className="text-sm text-muted">과정 정보를 불러오는 중입니다…</p>;
  }
  if (course.kind === "unavailable") {
    return <p className="text-sm text-muted">과정 이름을 불러오지 못했습니다</p>;
  }
  if (course.kind === "missing") {
    // 휴지통에 넣었거나 영구 삭제한 과정. 열 수 없으니 링크를 걸지 않는다
    return <p className="text-sm text-muted">(지운 과정)</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <Link
        href={courseTabHref(course.id, "fees")}
        className={cn(
          "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-button text-sm font-semibold text-primary hover:underline",
          focusRing,
        )}
      >
        <CourseDot courseId={course.id} />
        <span className="min-w-0">{course.title}</span>
      </Link>
      {course.client ? <span className="text-sm text-muted">· {course.client}</span> : null}
    </div>
  );
}

/** 입금 확인(입금일 = 오늘) / 입금 취소. 실패하면 줄 안에 안내를 띄운다 */
function PaidToggle({ fee, title, today }: { fee: Fee; title: string; today: DateString }) {
  const toast = useToast();
  const toggle = useAsyncAction((paidDate: DateString | null) => setFeePaid(fee.id, paidDate));
  const paid = fee.paidDate !== null;

  async function handleClick() {
    const next = paid ? null : today;
    const result = await toggle.run(next);
    if (!result.ok) return;
    toast.success(
      next === null
        ? `‘${title}’ 강사료의 입금 확인을 취소했습니다.`
        : `‘${title}’ 강사료를 ${formatDateKo(next)} 입금으로 기록했습니다.`,
    );
  }

  return (
    <>
      {paid ? (
        <Button variant="ghost" size="sm" onClick={handleClick} loading={toggle.pending} loadingLabel="입금 확인을 취소하는 중">
          입금 취소
          <span className="sr-only">(‘{title}’ 강사료)</span>
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleClick} loading={toggle.pending} loadingLabel="입금 확인을 기록하는 중">
          {toggle.pending ? null : <CheckIcon />}
          입금 확인
          <span className="sr-only">(‘{title}’ 강사료)</span>
        </Button>
      )}
      {toggle.error ? (
        <p role="alert" className="w-full text-sm text-danger md:text-right">
          {toggle.error}
        </p>
      ) : null}
    </>
  );
}
