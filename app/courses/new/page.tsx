import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { NewCourseForm } from "@/components/course-form/NewCourseForm";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "새 과정 만들기 · 강의 준비 보드",
};

// 입력 화면이라 머리글·네이비 타일·본문을 모두 좁은 폭(narrow)으로 맞춘다
export default function Page() {
  return (
    <RequireMember>
      <AppShell width="narrow">
        <NewCourseForm />
      </AppShell>
    </RequireMember>
  );
}
