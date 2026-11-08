import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { AppShell } from "@/components/layout/AppShell";
import { ArchiveScreen } from "./ArchiveScreen";

export const metadata: Metadata = {
  title: "보관함 · 강의 준비 보드",
};

export default function Page() {
  return (
    <RequireMember>
      <AppShell>
        <ArchiveScreen />
      </AppShell>
    </RequireMember>
  );
}
