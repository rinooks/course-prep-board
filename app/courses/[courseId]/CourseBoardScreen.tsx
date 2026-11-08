"use client";

// 주소에서 과정 id를 읽어, 팀원 확인(RequireMember)과 공통 틀(AppShell) 안에 과정 보드를 띄운다.
// 칸반은 가로로 길어서 화면 폭을 다 쓴다 (width="full").

import { useParams } from "next/navigation";
import { RequireMember } from "@/components/auth/RequireMember";
import { AppShell } from "@/components/layout/AppShell";
import { CourseBoard } from "@/components/board/CourseBoard";

export function CourseBoardScreen() {
  const params = useParams<{ courseId: string }>();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";

  return (
    <RequireMember>
      <AppShell width="full">
        {/* 다른 과정으로 옮겨 가면 화면 상태(열린 카드 등)를 새로 시작한다 */}
        <CourseBoard key={courseId} courseId={courseId} />
      </AppShell>
    </RequireMember>
  );
}
