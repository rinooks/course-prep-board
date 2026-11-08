"use client";

// 초안 탭 본문: 초안 종류 고르기, 왼쪽 "새 초안 만들기"(4단계), 오른쪽 "초안 기록"(판 목록·보기·확정).
// 재료·초안·결과물·회차·팀원을 실시간으로 구독한다.

import { useMemo, useState } from "react";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { createDraftVersion, subscribeDrafts, subscribeOutputs } from "@/lib/data/drafts";
import { subscribeMaterials } from "@/lib/data/materials";
import { subscribeMembers } from "@/lib/data/members";
import { subscribeSessions } from "@/lib/data/sessions";
import type { Course, Draft, Material, Member, Output, Session } from "@/lib/data/types";
import { DRAFT_KIND_LABELS, DRAFT_KINDS, type DraftKind } from "@/lib/domain/drafts";
import { filterMaterials, EMPTY_MATERIAL_FILTER } from "@/lib/domain/materials";
import { DraftComposer } from "./DraftComposer";
import { DraftHistory } from "./DraftHistory";

const NO_MATERIALS: Material[] = [];
const NO_DRAFTS: Draft[] = [];
const NO_OUTPUTS: Output[] = [];
const NO_SESSIONS: Session[] = [];
const NO_MEMBERS: Member[] = [];

const KIND_OPTIONS = DRAFT_KINDS.map((kind) => ({ value: kind, label: DRAFT_KIND_LABELS[kind] }));

type PerKind = Record<DraftKind, string>;
const EMPTY_PER_KIND: PerKind = { curriculum: "", slides: "", lab: "" };

interface SaveArgs {
  kind: DraftKind;
  content: string;
  request: string;
  materialIds: string[];
}

export function DraftsBody({ course }: { course: Course }) {
  const materials = useLiveSubscription(course.id, (onData, onError) => subscribeMaterials(course.id, onData, onError), NO_MATERIALS);
  const drafts = useLiveSubscription(course.id, (onData, onError) => subscribeDrafts(course.id, onData, onError), NO_DRAFTS);
  const outputs = useLiveSubscription(course.id, (onData, onError) => subscribeOutputs(course.id, onData, onError), NO_OUTPUTS);
  const sessions = useLiveSubscription(course.id, (onData, onError) => subscribeSessions(course.id, onData, onError), NO_SESSIONS);
  const members = useLiveSubscription("members", (onData, onError) => subscribeMembers(onData, onError), NO_MEMBERS);

  const [kind, setKind] = useState<DraftKind>("curriculum");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // 종류마다 따로 적어 두어, 종류를 바꿔도 쓰던 요청·붙여 넣은 답이 사라지지 않는다
  const [requests, setRequests] = useState<PerKind>(EMPTY_PER_KIND);
  const [pastes, setPastes] = useState<PerKind>(EMPTY_PER_KIND);
  const [selectedDraft, setSelectedDraft] = useState<Partial<Record<DraftKind, string>>>({});
  const retryIds = useRetryId();

  const liveMaterials = useMemo(() => filterMaterials(materials.value, EMPTY_MATERIAL_FILTER), [materials.value]);
  const kindDrafts = useMemo(() => drafts.value.filter((draft) => draft.kind === kind), [drafts.value, kind]);

  const save = useAsyncAction((args: SaveArgs) =>
    createDraftVersion(
      course.id,
      { kind: args.kind, content: args.content, request: args.request, materialIds: args.materialIds },
      drafts.value,
      // 같은 답으로 다시 눌러도(응답이 늦어 두 번 누름) 판이 두 개 생기지 않는다
      { id: retryIds.idFor(`${args.kind}:${args.content}`) },
    ),
  );

  async function handleSave(content: string, materialIds: string[]): Promise<boolean> {
    const result = await save.run({ kind, content, request: requests[kind], materialIds });
    if (!result.ok) return false;
    retryIds.reset();
    setPastes((current) => ({ ...current, [kind]: "" }));
    setSelectedDraft((current) => ({ ...current, [kind]: result.value }));
    return true;
  }

  const loadError = materials.error ?? drafts.error ?? outputs.error ?? sessions.error;
  const loading = !materials.loaded || !drafts.loaded || !outputs.loaded;

  return (
    <>
      <Section
        tile
        title="초안 종류"
        description="커리큘럼 → 슬라이드별 내용 → 실습 안내서 순서로 만들면 앞 초안을 재료처럼 참고하기 좋습니다."
      >
        <SegmentedControl label="초안 종류" options={KIND_OPTIONS} value={kind} onChange={setKind} />
      </Section>

      {loadError ? (
        <Alert
          tone="error"
          title="초안 화면에 필요한 내용을 불러오지 못했습니다"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                materials.retry();
                drafts.retry();
                outputs.retry();
                sessions.retry();
              }}
            >
              다시 시도
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : null}

      {loading && !loadError ? (
        <LoadingBlock label="재료와 초안을 불러오는 중입니다…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <Section title={`새 ${DRAFT_KIND_LABELS[kind]} 초안 만들기`}>
            <DraftComposer
              course={course}
              kind={kind}
              materials={liveMaterials}
              sessions={sessions.value}
              selectedIds={selectedIds}
              onSelectedChange={setSelectedIds}
              request={requests[kind]}
              onRequestChange={(value) => setRequests((current) => ({ ...current, [kind]: value }))}
              pasted={pastes[kind]}
              onPastedChange={(value) => setPastes((current) => ({ ...current, [kind]: value }))}
              onSave={handleSave}
              saving={save.pending}
              saveError={save.error && !save.fieldErrors.content ? save.error : null}
              contentError={save.fieldErrors.content}
            />
          </Section>
          <Section title="초안 기록">
            <DraftHistory
              courseId={course.id}
              kind={kind}
              drafts={kindDrafts}
              outputs={outputs.value}
              members={members.value}
              selectedId={selectedDraft[kind] ?? null}
              onSelect={(draftId) => setSelectedDraft((current) => ({ ...current, [kind]: draftId }))}
            />
          </Section>
        </div>
      )}
    </>
  );
}
