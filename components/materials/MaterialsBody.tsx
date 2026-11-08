"use client";

// 재료함 본문: 재료 넣기 버튼 3개, 걸러 보기, 재료 목록, 휴지통.
// 재료와 팀원 목록을 실시간으로 구독한다 (다른 강사가 넣은 재료도 새로고침 없이 보인다).

import { useMemo, useState, type ReactNode } from "react";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkIcon, MicIcon, NoteIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/Section";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useToast } from "@/components/ui/Toast";
import { epochDateLabel } from "@/components/home/labels";
import { labelForEmail, subscribeMembers } from "@/lib/data/members";
import { restoreMaterial, subscribeMaterials } from "@/lib/data/materials";
import type { Course, Material, Member } from "@/lib/data/types";
import { EMPTY_MATERIAL_FILTER, filterMaterials, MATERIAL_KIND_LABELS, type MaterialKind } from "@/lib/domain/materials";
import { MaterialCard } from "./MaterialCard";
import { MaterialFilters } from "./MaterialFilters";
import { MaterialFormModal } from "./MaterialFormModal";

const NO_MATERIALS: Material[] = [];
const NO_MEMBERS: Member[] = [];

type Editing = { kind: MaterialKind; material: Material | null } | null;

export function MaterialsBody({ course }: { course: Course }) {
  const materials = useLiveSubscription(
    course.id,
    (onData, onError) => subscribeMaterials(course.id, onData, onError),
    NO_MATERIALS,
  );
  const members = useLiveSubscription("members", (onData, onError) => subscribeMembers(onData, onError), NO_MEMBERS);
  const [filter, setFilter] = useState(EMPTY_MATERIAL_FILTER);
  const [editing, setEditing] = useState<Editing>(null);

  const all = materials.value;
  const live = useMemo(() => all.filter((material) => material.deletedAt === null), [all]);
  const trashed = useMemo(() => all.filter((material) => material.deletedAt !== null), [all]);
  const visible = useMemo(() => filterMaterials(all, filter), [all, filter]);
  const authors = useMemo(() => Array.from(new Set(live.map((material) => material.createdBy))).sort(), [live]);

  return (
    <>
      <Section
        title="재료 넣기"
        description="파일은 올리지 않습니다. 음성·문서 파일은 구글 드라이브 같은 곳에 두고 링크로 남겨 주세요."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <AddButton
            icon={<NoteIcon className="h-5 w-5" />}
            title="글 붙여 넣기"
            text="줌 회의 텍스트, 외부 AI 초안, 메모"
            onClick={() => setEditing({ kind: "text", material: null })}
          />
          <AddButton
            icon={<MicIcon className="h-5 w-5" />}
            title="받아쓰기"
            text="말하는 대로 글자로 바꿔 남기기"
            onClick={() => setEditing({ kind: "dictation", material: null })}
          />
          <AddButton
            icon={<LinkIcon className="h-5 w-5" />}
            title="링크 저장"
            text="드라이브 파일, 참고 웹 페이지"
            onClick={() => setEditing({ kind: "link", material: null })}
          />
        </div>
      </Section>

      <Section title="재료" meta={materials.loaded ? `${live.length}개` : undefined}>
        {materials.error ? (
          <Alert
            tone="error"
            title="재료를 불러오지 못했습니다"
            action={
              <Button variant="outline" size="sm" onClick={materials.retry}>
                다시 시도
              </Button>
            }
          >
            {materials.error}
          </Alert>
        ) : null}
        {!materials.loaded && !materials.error ? <LoadingBlock label="재료를 불러오는 중입니다…" /> : null}
        {materials.loaded && live.length === 0 ? (
          <EmptyState
            title="아직 재료가 없습니다"
            description="회의 기록, 받아쓰기, 참고 링크를 넣어 두면 초안 탭에서 골라 AI 요청문을 만들 수 있습니다."
          />
        ) : null}
        {materials.loaded && live.length > 0 ? (
          <>
            <MaterialFilters filter={filter} onChange={setFilter} authors={authors} members={members.value} />
            {visible.length === 0 ? (
              <EmptyState
                size="sm"
                title="조건에 맞는 재료가 없습니다"
                description="찾는 조건을 바꾸거나 '조건 지우기'를 눌러 주세요."
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visible.map((material) => (
                  <li key={material.id}>
                    <MaterialCard
                      material={material}
                      members={members.value}
                      onOpen={() => setEditing({ kind: material.kind, material })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </Section>

      {trashed.length > 0 ? (
        <TrashedMaterials courseId={course.id} materials={trashed} members={members.value} />
      ) : null}

      {editing ? (
        <MaterialFormModal
          // 다른 재료를 열면 입력 상태를 새로 시작한다
          key={editing.material?.id ?? `new-${editing.kind}`}
          courseId={course.id}
          kind={editing.kind}
          material={editing.material}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

interface AddButtonProps {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}

/** 재료 넣기 버튼 (큰 카드 모양). 카드 전체가 버튼이다 */
function AddButton({ icon, title, text, onClick }: AddButtonProps) {
  return (
    <button type="button" onClick={onClick} className={cn("group rounded-tile text-left", focusRing)}>
      <Card interactive className="flex h-full items-start gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-ink group-hover:text-primary">{title}</span>
          <span className="text-sm text-muted">{text}</span>
        </span>
      </Card>
    </button>
  );
}

/** 휴지통에 넣은 재료 (접어 둔다). 되살리기 가능 */
function TrashedMaterials({
  courseId,
  materials,
  members,
}: {
  courseId: string;
  materials: readonly Material[];
  members: readonly Member[];
}) {
  return (
    <Section title="휴지통" meta={`${materials.length}개`} description="지운 재료입니다. 되살리면 재료 목록으로 돌아갑니다.">
      <Card padding="none">
        <ul className="divide-y divide-line">
          {materials.map((material) => (
            <TrashedRow key={material.id} courseId={courseId} material={material} members={members} />
          ))}
        </ul>
      </Card>
    </Section>
  );
}

function TrashedRow({ courseId, material, members }: { courseId: string; material: Material; members: readonly Member[] }) {
  const toast = useToast();
  const restore = useAsyncAction(() => restoreMaterial(courseId, material.id));
  const who = material.deletedBy ? labelForEmail(material.deletedBy, members) : "알 수 없음";
  const when = epochDateLabel(material.deletedAt);

  async function handleRestore() {
    const result = await restore.run();
    if (result.ok) toast.success(`'${material.title}' 재료를 되살렸습니다.`);
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-base font-semibold text-ink">{material.title}</p>
        <p className="text-sm text-muted">
          {MATERIAL_KIND_LABELS[material.kind]} · {who}님이 지움{when ? ` · ${when}` : ""}
        </p>
        {restore.error ? <p className="text-sm text-danger">{restore.error}</p> : null}
      </div>
      <Button variant="outline" size="sm" onClick={handleRestore} loading={restore.pending} loadingLabel="되살리는 중">
        되살리기
      </Button>
    </li>
  );
}
