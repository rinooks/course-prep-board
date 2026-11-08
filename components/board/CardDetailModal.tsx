"use client";

// 카드 상세 창: 끝남 표시, 단계 이동, 제목·담당자·마감일·메모 고치기, 첨부 파일, 체크리스트, 카드 삭제(휴지통).
// 고친 칸을 저장하지 않고 닫으려 하거나, 파일을 올리는 중에 닫으려 하면 한 번 묻는다 (입력한 내용을 잃지 않게).
// 다른 강사가 카드를 바꾸면 손대지 않은 칸은 바로 새 값으로 바뀐다.

import { useId, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { InlineLoading } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useToast } from "@/components/ui/Toast";
import { restoreCard, setCardDone, softDeleteCard } from "@/lib/data/cards";
import { labelForEmail } from "@/lib/data/members";
import type { Card, CardFile, ChecklistItem, Member } from "@/lib/data/types";
import { stageLabel } from "@/lib/domain/stages";
import { hasEdits, type CardEdits } from "./cardEdits";
import { CardFieldsForm } from "./CardFieldsForm";
import { CardFilesSection } from "./CardFilesSection";
import { ChecklistEditor } from "./ChecklistEditor";
import { CheckIcon, TrashIcon } from "@/components/ui/icons";
import { StageMoveControl } from "./StageMoveControl";
import { useFileUploads } from "./useFileUploads";

interface CardDetailModalProps {
  courseId: string;
  /** 연 카드 id */
  cardId: string;
  /** 과정의 모든 카드 (휴지통 포함). 연 카드를 여기서 찾는다 */
  cards: readonly Card[];
  cardsLoaded: boolean;
  /** 이 카드의 체크리스트 항목 (order 순) */
  checklistItems: readonly ChecklistItem[];
  checklistLoaded: boolean;
  checklistError: string | null;
  onRetryChecklist: () => void;
  /** 이 카드의 첨부 파일 (올린 순서) */
  files: readonly CardFile[];
  filesLoaded: boolean;
  filesError: string | null;
  onRetryFiles: () => void;
  members: readonly Member[];
  onClose: () => void;
}

export function CardDetailModal({
  courseId,
  cardId,
  cards,
  cardsLoaded,
  checklistItems,
  checklistLoaded,
  checklistError,
  onRetryChecklist,
  files,
  filesLoaded,
  filesError,
  onRetryFiles,
  members,
  onClose,
}: CardDetailModalProps) {
  const toast = useToast();
  const checklistHeadingId = useId();
  const filesHeadingId = useId();
  const uploads = useFileUploads();
  const [edits, setEdits] = useState<CardEdits>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [stopUploadOpen, setStopUploadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const card = cards.find((item) => item.id === cardId) ?? null;
  const dirty = hasEdits(edits);

  const toggleDone = useAsyncAction((done: boolean) => setCardDone(courseId, cardId, done));
  const restore = useAsyncAction(() => restoreCard(courseId, cardId));

  function requestClose() {
    if (uploads.busy) {
      setStopUploadOpen(true);
      return;
    }
    if (dirty && card !== null && card.deletedAt === null) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  async function handleDelete() {
    await softDeleteCard(courseId, cardId);
    onClose();
    toast.success("카드를 삭제했습니다. 보드 아래 '삭제한 카드'에서 되살릴 수 있습니다.");
  }

  const dialogs = (
    <>
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setEdits({});
          onClose();
        }}
        title="저장하지 않은 내용이 있습니다"
        description="고친 내용을 저장하지 않고 닫으면 사라집니다. 저장하려면 '계속 고치기'를 누른 뒤 '변경 내용 저장'을 눌러 주세요."
        confirmLabel="저장하지 않고 닫기"
        cancelLabel="계속 고치기"
        tone="danger"
      />
      <ConfirmDialog
        open={stopUploadOpen}
        onClose={() => setStopUploadOpen(false)}
        onConfirm={() => {
          uploads.clear();
          setEdits({});
          onClose();
        }}
        title="파일을 올리는 중입니다"
        description="지금 닫으면 다 올라가지 않은 파일은 붙지 않습니다. 고치고 저장하지 않은 칸이 있으면 그 내용도 사라집니다. 다 올라갈 때까지 기다리려면 '기다리기'를 눌러 주세요."
        confirmLabel="올리기 멈추고 닫기"
        cancelLabel="기다리기"
        tone="danger"
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="이 카드를 삭제할까요?"
        description="보드에서 사라지고 '삭제한 카드' 목록으로 옮겨집니다. 체크리스트도 함께 보관되어, 되살리면 그대로 돌아옵니다."
        confirmLabel="삭제"
        tone="danger"
      />
    </>
  );

  // 아직 불러오는 중이거나, 다른 사람이 완전히 지운 카드
  if (card === null) {
    return (
      <Modal
        open
        onClose={onClose}
        title={cardsLoaded ? "카드를 찾을 수 없습니다" : "카드를 여는 중입니다"}
        size="sm"
        footer={
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        }
      >
        {cardsLoaded ? (
          <p className="text-base leading-relaxed text-ink">
            다른 사람이 이 카드를 완전히 지웠을 수 있습니다. 창을 닫고 보드를 확인해 주세요.
          </p>
        ) : (
          <InlineLoading label="카드를 여는 중입니다…" />
        )}
      </Modal>
    );
  }

  const trashed = card.deletedAt !== null;
  const editedBy = card.updatedBy ? labelForEmail(card.updatedBy, members) : "";

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        closeOnBackdrop={false}
        size="lg"
        title={card.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{stageLabel(card.stage)}</Badge>
            {card.done ? (
              <Badge tone="success">
                <CheckIcon className="h-3.5 w-3.5" />
                끝남
              </Badge>
            ) : null}
            {editedBy ? <span className="break-anywhere">마지막으로 고친 사람: {editedBy}</span> : null}
          </span>
        }
        footer={
          <>
            {!trashed ? (
              <Button variant="dangerGhost" className="md:mr-auto" onClick={() => setDeleteOpen(true)}>
                <TrashIcon />
                카드 삭제
              </Button>
            ) : null}
            <Button variant="outline" onClick={requestClose}>
              닫기
            </Button>
          </>
        }
      >
        {trashed ? (
          <div className="flex flex-col gap-3">
            <Alert
              tone="warning"
              title="삭제한 카드입니다"
              action={
                <Button size="sm" onClick={() => restore.run()} loading={restore.pending} loadingLabel="되살리는 중">
                  되살리기
                </Button>
              }
            >
              보드에는 보이지 않습니다. 다시 쓰려면 &lsquo;되살리기&rsquo;를 눌러 주세요.
            </Alert>
            {restore.error ? (
              <Alert tone="error" title="카드를 되살리지 못했습니다">
                {restore.error}
              </Alert>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 md:items-end">
              <div className="flex flex-col gap-1.5">
                {/* 입력칸 라벨(Field)과 같은 모양. label로 묶으면 버튼 이름("끝남으로 표시")을 덮으므로 글자로만 둔다 */}
                <p className="text-sm font-semibold text-ink">진행 상태</p>
                <Button
                  variant={card.done ? "outline" : "solid"}
                  onClick={() => toggleDone.run(!card.done)}
                  loading={toggleDone.pending}
                  loadingLabel="저장하는 중"
                >
                  <CheckIcon />
                  {card.done ? "끝남 표시 취소" : "끝남으로 표시"}
                </Button>
              </div>
              <StageMoveControl courseId={courseId} card={card} cards={cards} />
            </div>
            {toggleDone.error ? (
              <Alert tone="error" title="진행 상태를 저장하지 못했습니다">
                {toggleDone.error}
              </Alert>
            ) : null}

            <CardFieldsForm
              courseId={courseId}
              card={card}
              members={members}
              edits={edits}
              onEditsChange={setEdits}
            />

            <hr className="border-line" />

            <CardFilesSection
              courseId={courseId}
              cardId={card.id}
              files={files}
              loaded={filesLoaded}
              error={filesError}
              onRetry={onRetryFiles}
              members={members}
              uploads={uploads}
              headingId={filesHeadingId}
            />

            <hr className="border-line" />

            <ChecklistEditor
              courseId={courseId}
              cardId={card.id}
              items={checklistItems}
              loaded={checklistLoaded}
              error={checklistError}
              onRetry={onRetryChecklist}
              headingId={checklistHeadingId}
            />
          </div>
        )}
      </Modal>
      {dialogs}
    </>
  );
}
