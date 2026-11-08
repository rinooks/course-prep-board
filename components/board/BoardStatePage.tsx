"use client";

// 과정 보드 본문 대신 보이는 상태 화면의 틀: 불러오는 중, 불러오기 실패, 열 수 없는 과정.
// 로그인 뒤 모든 화면처럼 네이비 타일(PageHeader)를 먼저 두고, 그 아래 PageBody에 안내를 놓는다 (design.md 4장 "부품 규칙").

import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/layout/Page";

interface BoardStatePageProps {
  /** 띠의 제목. 지금 상태를 한 문장으로 (예: "과정을 불러오는 중입니다") */
  title: string;
  children: ReactNode;
}

export function BoardStatePage({ title, children }: BoardStatePageProps) {
  return (
    <>
      <PageHeader eyebrow="과정 보드" title={title} />
      <PageBody>{children}</PageBody>
    </>
  );
}
