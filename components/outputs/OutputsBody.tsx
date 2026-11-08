"use client";

// 결과물 탭 본문: 종류(커리큘럼·슬라이드별 내용·실습 안내서)마다 구역 하나, 맨 아래 휴지통.
// 결과물은 초안 탭에서 "확정"을 누르면 생긴다. 여기서는 목록·내려받기·최종본 관리만 한다.

import { courseTabHref } from "@/components/course/CourseTabs";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { Alert } from "@/components/ui/Alert";
import { BentoGrid } from "@/components/ui/Bento";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { subscribeOutputs } from "@/lib/data/drafts";
import type { Course, Member, Output } from "@/lib/data/types";
import { DRAFT_KINDS, DRAFT_KIND_LABELS, type DraftKind } from "@/lib/domain/drafts";
import { OutputCard } from "./OutputCard";
import { TrashedOutputsPanel } from "./TrashedOutputsPanel";
import { EMPTY_KIND_TITLES } from "./outputLabels";

// 첫 데이터 전 값. 매번 같은 배열을 넘겨야 화면이 쓸데없이 다시 그려지지 않는다
const NO_OUTPUTS: Output[] = [];
const NO_MEMBERS: Member[] = [];

export function OutputsBody({ course }: { course: Course }) {
  const outputs = useLiveSubscription<Output[]>(
    course.id,
    (onData, onError) => subscribeOutputs(course.id, onData, onError),
    NO_OUTPUTS,
  );
  // 이름 표시용. 못 받아도 이메일로 보여 주므로 오류는 따로 알리지 않는다
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  const retryButton = (
    <Button variant="outline" size="sm" onClick={outputs.retry}>
      다시 시도
    </Button>
  );

  if (!outputs.loaded) {
    return outputs.error ? (
      <Alert tone="error" title="결과물을 불러오지 못했습니다" action={retryButton}>
        {outputs.error}
      </Alert>
    ) : (
      <InlineLoading label="결과물을 불러오는 중입니다…" />
    );
  }

  const active = outputs.value.filter((output) => output.deletedAt === null);
  const trashed = outputs.value.filter((output) => output.deletedAt !== null);

  return (
    <>
      {outputs.error ? (
        <Alert tone="warning" title="실시간 연결이 끊겼습니다" action={retryButton}>
          보이는 결과물이 최신이 아닐 수 있습니다. {outputs.error}
        </Alert>
      ) : null}
      <BentoGrid layout="thirds">
        {DRAFT_KINDS.map((kind) => (
          <OutputKindSection
            key={kind}
            kind={kind}
            course={course}
            items={active.filter((output) => output.kind === kind)}
            outputs={active}
            members={members}
          />
        ))}
      </BentoGrid>
      <TrashedOutputsPanel courseId={course.id} outputs={trashed} members={members} />
    </>
  );
}

interface OutputKindSectionProps {
  kind: DraftKind;
  course: Course;
  /** 이 종류의 결과물 (최신 판이 앞) */
  items: readonly Output[];
  /** 휴지통 밖 결과물 전체 */
  outputs: readonly Output[];
  members: readonly Member[];
}

function OutputKindSection({ kind, course, items, outputs, members }: OutputKindSectionProps) {
  return (
    <Section title={DRAFT_KIND_LABELS[kind]} meta={`${items.length}개`} className="h-full">
      {items.length === 0 ? (
        <EmptyState
          size="sm"
          className="flex-1 justify-center"
          title={EMPTY_KIND_TITLES[kind]}
          description="초안 탭에서 AI 초안을 검토한 뒤 '확정'을 누르면 여기에 판 번호와 함께 쌓입니다."
          action={
            <ButtonLink href={courseTabHref(course.id, "drafts")} variant="outline" size="sm">
              초안 탭으로 가기
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((output) => (
            <li key={output.id} className="min-w-0">
              <OutputCard course={course} output={output} outputs={outputs} members={members} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
