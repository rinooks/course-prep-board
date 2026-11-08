"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCourseList } from "@/components/home/useCourseList";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { cn, focusRing } from "@/components/ui/cn";
import { Section } from "@/components/ui/Section";
import { tabId, tabPanelId, Tabs, type TabItem } from "@/components/ui/Tabs";
import type { Member } from "@/lib/data/types";
import { ArchivedCourseList } from "./ArchivedCourseList";
import { TrashedCourseList } from "./TrashedCourseList";

type ArchiveTab = "archived" | "trash";

/** 탭·패널 id 앞에 붙는 이름 (archive-tab-archived, archive-panel-trash …) */
const TAB_GROUP = "archive";

const NO_MEMBERS: Member[] = [];

/** 보관함: 보관된 과정 + (관리자에게만) 휴지통 */
export function ArchiveScreen() {
  const { isAdmin } = useAuth();
  const archived = useCourseList("archived");
  // 관리자가 아니면 휴지통을 구독하지 않는다
  const trashed = useCourseList("trashed", isAdmin);
  // 이름 표시용. 못 받으면 이메일로 보여준다
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  const [tab, setTab] = useState<ArchiveTab>("archived");
  const activeTab: ArchiveTab = isAdmin ? tab : "archived";

  const archivedList = (
    <ArchivedCourseList
      courses={archived.courses}
      error={archived.error}
      onRetry={archived.retry}
      members={members}
      isAdmin={isAdmin}
    />
  );

  const tabs: TabItem<ArchiveTab>[] = [
    { id: "archived", label: "보관된 과정", count: archived.courses?.length ?? null },
    { id: "trash", label: "휴지통", count: trashed.courses?.length ?? null },
  ];

  return (
    <>
      <PageHeader
        eyebrow="지난 과정"
        title="보관함"
        description="강의가 끝나 보관한 과정을 모아 둔 곳입니다. 보관한 과정은 홈 목록에서 빠지고, 언제든 진행 중으로 되돌릴 수 있습니다."
      />
      <PageBody>
        {isAdmin ? (
          <div className="flex flex-col gap-3">
            <Tabs group={TAB_GROUP} tabs={tabs} selected={activeTab} onSelect={setTab} label="보관함 보기" />
            {tabs.map((item) => (
              <div
                key={item.id}
                id={tabPanelId(TAB_GROUP, item.id)}
                role="tabpanel"
                aria-labelledby={tabId(TAB_GROUP, item.id)}
                tabIndex={0}
                hidden={item.id !== activeTab}
                className={cn("rounded-tile", focusRing)}
              >
                {item.id === "archived" ? (
                  archivedList
                ) : (
                  <TrashedCourseList
                    courses={trashed.courses}
                    error={trashed.error}
                    onRetry={trashed.retry}
                    members={members}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <Section title="보관된 과정" meta={archived.courses ? `${archived.courses.length}개` : null}>
            {archivedList}
          </Section>
        )}
      </PageBody>
    </>
  );
}
