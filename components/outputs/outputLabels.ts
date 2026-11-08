// 결과물 화면의 주소·문구 만들기 (순수 함수). 결과물 탭과 인쇄 화면이 같이 쓴다.

import { epochDateLabel } from "@/components/home/labels";
import { labelForEmail } from "@/lib/data/members";
import type { Member, Output } from "@/lib/data/types";
import { DRAFT_KIND_LABELS, type DraftKind } from "@/lib/domain/drafts";

/** 인쇄(PDF로 저장) 화면 주소 */
export function outputPrintHref(courseId: string, outputId: string): string {
  return `/courses/${encodeURIComponent(courseId)}/outputs/${encodeURIComponent(outputId)}/print`;
}

/** "3판" */
export function versionLabel(version: number): string {
  return `${version}판`;
}

/** "슬라이드별 내용 3판" */
export function outputTitle(output: Pick<Output, "kind" | "version">): string {
  return `${DRAFT_KIND_LABELS[output.kind]} ${versionLabel(output.version)}`;
}

/** 빈 구역 제목. 받침에 맞춰 "이/가"를 고른다 */
export const EMPTY_KIND_TITLES: Record<DraftKind, string> = {
  curriculum: "아직 확정한 커리큘럼이 없습니다",
  slides: "아직 확정한 슬라이드별 내용이 없습니다",
  lab: "아직 확정한 실습 안내서가 없습니다",
};

/** 확정한 날 "2026년 10월 3일 (토)". 저장 직후라 시각이 아직 없으면 "방금" */
export function confirmedDateLabel(createdAt: number | null): string {
  return epochDateLabel(createdAt) ?? "방금";
}

/** 만든 사람 이름 (팀원 목록에 없으면 이메일) */
export function authorLabel(email: string, members: readonly Member[]): string {
  return labelForEmail(email, members) || "알 수 없음";
}
