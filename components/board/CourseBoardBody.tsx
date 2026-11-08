"use client";

// 과정 보드 본문 (벤토 격자): 머리(과정 정보·진행률) + 최근 활동 → 회차 + 준비 일정(리허설·회의) + 고객사 담당자 → 7단계 칸반 → 삭제한 카드, 그리고 카드 상세 창.
// 각 영역은 자기 데이터의 오류를 따로 보여주고, "다시 시도"는 그 구독만 다시 연다.
// 주소에 ?card=카드id가 있으면(홈의 "마감이 다가온 카드"에서 온 경우) 그 카드 상세를 바로 연다.
// 타일 사이 간격(gap-4)은 PageBody와 BentoGrid가 정한다.

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { BentoGrid } from "@/components/ui/Bento";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { LoadingBlock } from "@/components/ui/Spinner";
import { PageBody } from "@/components/layout/Page";
import type { CardFile, ChecklistItem, Course } from "@/lib/data/types";
import { groupChecklistByCard } from "@/lib/domain/board";
import { groupFilesByCard } from "@/lib/domain/cardFiles";
import type { DateString } from "@/lib/domain/dates";
import { summarizeProgress } from "@/lib/domain/progress";
import { CardDetailModal } from "./CardDetailModal";
import { ClientContactsSection } from "./ClientContactsSection";
import { CourseHeader } from "./CourseHeader";
import { EventsSection } from "./EventsSection";
import { KanbanBoard } from "./KanbanBoard";
import { RecentActivity } from "./RecentActivity";
import { SessionsSection } from "./SessionsSection";
import { StageJumpNav } from "./StageJumpNav";
import { TrashedCardsPanel } from "./TrashedCardsPanel";
import type { CourseBoardData } from "./useCourseBoardData";

const NO_ITEMS: ChecklistItem[] = [];
const NO_FILES: CardFile[] = [];

interface CourseBoardBodyProps {
  course: Course;
  data: CourseBoardData;
  today: DateString;
  isAdmin: boolean;
  onRequestTrash: () => void;
}

export function CourseBoardBody({ course, data, today, isAdmin, onRequestTrash }: CourseBoardBodyProps) {
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const linkedCardId = useSearchParams().get("card") || null;
  // 보드에서 직접 고른 카드가 먼저, 없으면 주소로 받은 카드
  const openCardId = pickedCardId ?? linkedCardId;

  function closeCard() {
    setPickedCardId(null);
    // 주소의 카드 표시를 지워야 창이 다시 열리지 않는다
    if (linkedCardId) router.replace(pathname, { scroll: false });
  }

  const cards = data.cards.value;
  const members = data.members.value;
  const progress = useMemo(() => summarizeProgress(cards), [cards]);
  const checklistByCard = useMemo(
    () => groupChecklistByCard(data.checklistItems.value),
    [data.checklistItems.value],
  );
  const openCardItems = openCardId ? (checklistByCard[openCardId] ?? NO_ITEMS) : NO_ITEMS;
  const filesByCard = useMemo(() => groupFilesByCard(data.cardFiles.value), [data.cardFiles.value]);
  const openCardFiles = openCardId ? (filesByCard[openCardId] ?? NO_FILES) : NO_FILES;

  return (
    <PageBody>
      <BentoGrid layout="main-side">
        <CourseHeader
          course={course}
          members={members}
          membersLoaded={data.members.loaded}
          sessions={data.sessions.value}
          sessionsLoaded={data.sessions.loaded}
          progress={progress}
          cards={cards}
          cardsLoaded={data.cards.loaded}
          checklistItems={data.checklistItems.value}
          checklistLoaded={data.checklistItems.loaded && !data.checklistItems.error}
          today={today}
          isAdmin={isAdmin}
          onRequestTrash={onRequestTrash}
        />
        <RecentActivity courseId={course.id} />
      </BentoGrid>

      {data.course.error ? (
        <Alert
          tone="warning"
          title="실시간 연결이 끊겼습니다"
          action={
            <Button variant="outline" size="sm" onClick={data.course.retry}>
              다시 시도
            </Button>
          }
        >
          지금 보이는 과정 정보가 최신이 아닐 수 있습니다. {data.course.error}
        </Alert>
      ) : null}

      {course.status === "archived" ? (
        <Alert tone="info" title="보관한 과정입니다">
          홈 목록에는 보이지 않지만 보드는 그대로 고칠 수 있습니다. 다시 진행하려면 &lsquo;보관 해제&rsquo;를 눌러
          주세요.
        </Alert>
      ) : null}

      {data.members.error ? (
        <Alert
          tone="warning"
          title="팀원 목록을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={data.members.retry}>
              다시 시도
            </Button>
          }
        >
          담당자가 이름 대신 이메일로 보입니다. {data.members.error}
        </Alert>
      ) : null}

      <BentoGrid layout="thirds">
        <SessionsSection
          courseId={course.id}
          sessions={data.sessions.value}
          loaded={data.sessions.loaded}
          error={data.sessions.error}
          onRetry={data.sessions.retry}
          today={today}
        />

        <EventsSection
          courseId={course.id}
          events={data.events.value}
          loaded={data.events.loaded}
          error={data.events.error}
          onRetry={data.events.retry}
          today={today}
        />

        <ClientContactsSection clientName={course.client} />
      </BentoGrid>

      <Section
        tile
        title="준비 단계"
        description={
          <>
            카드를 끌어서 다른 단계로 옮기거나 순서를 바꿉니다. 휴대폰에서는 카드를 눌러 &lsquo;단계 이동&rsquo;을
            쓰세요.
          </>
        }
      >
        {data.cards.error ? (
          <Alert
            tone="error"
            title="카드를 불러오지 못했습니다"
            action={
              <Button variant="outline" size="sm" onClick={data.cards.retry}>
                다시 시도
              </Button>
            }
          >
            {data.cards.error}
          </Alert>
        ) : null}
        {data.checklistItems.error ? (
          <Alert
            tone="warning"
            title="체크리스트 진행률을 불러오지 못했습니다"
            action={
              <Button variant="outline" size="sm" onClick={data.checklistItems.retry}>
                다시 시도
              </Button>
            }
          >
            {data.checklistItems.error}
          </Alert>
        ) : null}

        {data.cards.loaded ? <StageJumpNav progress={progress} /> : null}

        {data.cards.loaded ? (
          <KanbanBoard
            courseId={course.id}
            cards={cards}
            checklistItems={data.checklistItems.value}
            cardFiles={data.cardFiles.value}
            members={members}
            today={today}
            onOpenCard={setPickedCardId}
          />
        ) : data.cards.error ? null : (
          <LoadingBlock label="카드를 불러오는 중입니다…" />
        )}
      </Section>

      <TrashedCardsPanel courseId={course.id} cards={cards} members={members} />

      {openCardId ? (
        <CardDetailModal
          key={openCardId}
          courseId={course.id}
          cardId={openCardId}
          cards={cards}
          cardsLoaded={data.cards.loaded}
          checklistItems={openCardItems}
          checklistLoaded={data.checklistItems.loaded}
          checklistError={data.checklistItems.error}
          onRetryChecklist={data.checklistItems.retry}
          files={openCardFiles}
          filesLoaded={data.cardFiles.loaded}
          filesError={data.cardFiles.error}
          onRetryFiles={data.cardFiles.retry}
          members={members}
          onClose={closeCard}
        />
      ) : null}
    </PageBody>
  );
}
