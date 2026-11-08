// 같은 화면 안의 다른 곳으로 옮겨 가기 (요약 칸 → 목록, 단계 바로가기 → 칸반 칸).
// 주소(#)는 바꾸지 않는다. 바꾸면 뒤로 가기를 눌러도 화면 안에서만 오르내려 헷갈린다.

import type { MouseEvent } from "react";

/**
 * id가 붙은 곳까지 스크롤하고, 키보드·화면 낭독기 사용자를 위해 초점도 그곳으로 옮긴다.
 * 대상에는 tabIndex={-1}과 머리글 높이만큼의 scroll-mt를 붙여 둔다.
 * 대상이 없으면(아직 불러오는 중 등) 아무 일도 하지 않는다.
 */
export function jumpToElement(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start", inline: "start" });
  target.focus({ preventScroll: true });
}

/** <a href="#id">의 onClick용. 기본 이동(주소 바꾸기)을 막고 jumpToElement로 옮긴다 */
export function handleJumpClick(event: MouseEvent<HTMLAnchorElement>, id: string): void {
  // 새 탭 열기(Ctrl·가운데 클릭 등)는 브라우저 기본 동작에 맡긴다
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  jumpToElement(id);
}
