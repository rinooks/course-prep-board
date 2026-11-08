"use client";

// 과정 화면(재료함·초안·결과물) 주소의 입구: 주소에서 과정 id를 읽어
// 팀원 확인(RequireMember)과 공통 틀(AppShell) 안에 화면을 띄운다.
// 보드와 같은 폭(full)을 써서 탭을 오갈 때 머리글이 움직이지 않게 한다.
// useParams를 쓰므로 page.tsx에서 Suspense로 감싼다 (cacheComponents 규칙).

import { Fragment, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { RequireMember } from "@/components/auth/RequireMember";
import { AppShell } from "@/components/layout/AppShell";

export function CourseRoute({ children }: { children: (courseId: string) => ReactNode }) {
  const params = useParams<{ courseId: string }>();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";

  return (
    <RequireMember>
      <AppShell width="full">
        {/* 다른 과정으로 옮겨 가면 화면 상태(입력 중인 글 등)를 새로 시작한다 */}
        <Fragment key={courseId}>{children(courseId)}</Fragment>
      </AppShell>
    </RequireMember>
  );
}
