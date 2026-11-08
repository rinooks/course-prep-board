// AI 초안(drafts)과 결과물(outputs) 읽기·쓰기 (PRD F6·F7).
// - 초안: 종류별 판(version)이 쌓인다. 새 판을 저장할 때 종류별 최근 10판만 남기고 옛 판은 같은 묶음 쓰기에서 지운다.
// - 확정: 초안 내용을 그대로 복사한 결과물을 만든다. 결과물 내용은 고치지 않는다 (판 기록을 믿을 수 있게).

import { deleteDoc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { draftsToPrune, nextVersion } from "@/lib/domain/drafts";
import { createId } from "@/lib/domain/ids";
import { validateDraftContent, validateDraftInput, validateOutputLink } from "@/lib/domain/validation";
import { courseChildCol, courseChildDoc } from "./refs";
import { toDraft, toOutput } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  CreateOptions,
  Draft,
  DraftCreateInput,
  DraftKind,
  ErrorHandler,
  Output,
  Unsubscribe,
} from "./types";

function byVersionDesc<T extends { version: number; id: string }>(a: T, b: T): number {
  if (a.version !== b.version) return b.version - a.version;
  return a.id < b.id ? -1 : 1;
}

/** 과정의 초안 구독 (최신 판이 앞) */
export function subscribeDrafts(
  courseId: string,
  onData: (drafts: Draft[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => courseChildCol(courseId, "drafts"),
    (snapshot) => toDraft(courseId, snapshot),
    (drafts) => onData([...drafts].sort(byVersionDesc)),
    onError,
  );
}

/** 과정의 결과물 구독 (휴지통 포함, 최신 판이 앞) */
export function subscribeOutputs(
  courseId: string,
  onData: (outputs: Output[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => courseChildCol(courseId, "outputs"),
    (snapshot) => toOutput(courseId, snapshot),
    (outputs) => onData([...outputs].sort(byVersionDesc)),
    onError,
  );
}

/**
 * 새 초안 판 저장 (AI 답을 붙여 넣은 것).
 * existing: 지금 화면에 있는 이 과정의 초안 목록. 판 번호와 지울 옛 판을 여기서 계산한다.
 * 돌려주는 값: 새 초안 id
 */
export async function createDraftVersion(
  courseId: string,
  input: DraftCreateInput,
  existing: readonly Draft[],
  options: CreateOptions = {},
): Promise<string> {
  const check = validateDraftInput({
    kind: input.kind,
    content: input.content,
    request: input.request ?? "",
    materialIds: input.materialIds ?? [],
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const draftId = options.id ?? createId();
  const batch = writeBatch(getDb());
  batch.set(courseChildDoc(courseId, "drafts", draftId), {
    ...check.value,
    version: nextVersion(existing, check.value.kind),
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  for (const oldId of draftsToPrune(existing, check.value.kind)) {
    batch.delete(courseChildDoc(courseId, "drafts", oldId));
  }
  await runWrite(() => batch.commit(), `draft:create:${courseId}:${draftId}`);
  return draftId;
}

/** 초안 내용 고치기 */
export async function updateDraftContent(courseId: string, draftId: string, content: string): Promise<void> {
  const check = validateDraftContent(content);
  if (!check.ok) throwValidation(check.errors);
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "drafts", draftId), {
      content: check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 초안 판 지우기 (잘못 붙여 넣은 판 등). 이 판으로 확정한 결과물은 그대로 남는다 */
export async function deleteDraft(courseId: string, draftId: string): Promise<void> {
  await runWrite(() => deleteDoc(courseChildDoc(courseId, "drafts", draftId)));
}

/**
 * 초안 확정 → 결과물 만들기. 확정한 순간의 내용을 그대로 담는다.
 * existingOutputs: 이 과정의 결과물 목록 (판 번호 계산용). 돌려주는 값: 결과물 id
 */
export async function confirmDraft(
  courseId: string,
  draft: Pick<Draft, "id" | "kind" | "content">,
  existingOutputs: readonly Output[],
  options: CreateOptions = {},
): Promise<string> {
  const check = validateDraftContent(draft.content);
  if (!check.ok) throwValidation(check.errors);
  const actor = requireActorEmail();
  const outputId = options.id ?? createId();
  const batch = writeBatch(getDb());
  batch.set(courseChildDoc(courseId, "outputs", outputId), {
    kind: draft.kind,
    version: nextVersion(existingOutputs, draft.kind),
    content: check.value,
    sourceDraftId: draft.id,
    finalUrl: "",
    isFinal: false,
    deletedAt: null,
    deletedBy: null,
    createdBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  await runWrite(() => batch.commit(), `output:create:${courseId}:${outputId}`);
  return outputId;
}

/** 최종본 링크 넣기·바꾸기·지우기 (빈 문자열이면 지운다) */
export async function setOutputFinalUrl(courseId: string, outputId: string, rawUrl: string): Promise<void> {
  const check = validateOutputLink(rawUrl);
  if (!check.ok) throwValidation(check.errors);
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "outputs", outputId), {
      finalUrl: check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/**
 * 최종본 표시. 같은 종류에서 최종본은 하나만 둔다: 이 판을 최종본으로 하면 다른 판의 표시는 한 묶음으로 내린다.
 * final=false면 이 판의 표시만 내린다.
 */
export async function markOutputFinal(
  courseId: string,
  output: Pick<Output, "id" | "kind">,
  final: boolean,
  outputs: readonly Output[],
): Promise<void> {
  const actor = requireActorEmail();
  const stamp = { updatedAt: serverTimestamp(), updatedBy: actor };
  const batch = writeBatch(getDb());
  batch.update(courseChildDoc(courseId, "outputs", output.id), { isFinal: final, ...stamp });
  if (final) {
    for (const other of outputs) {
      if (other.id !== output.id && other.kind === output.kind && other.isFinal) {
        batch.update(courseChildDoc(courseId, "outputs", other.id), { isFinal: false, ...stamp });
      }
    }
  }
  await runWrite(() => batch.commit());
}

/** 결과물 휴지통으로 / 되살리기 */
export async function setOutputTrashed(courseId: string, outputId: string, trashed: boolean): Promise<void> {
  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(courseChildDoc(courseId, "outputs", outputId), {
      deletedAt: trashed ? serverTimestamp() : null,
      deletedBy: trashed ? actor : null,
      // 휴지통에 넣으면 최종본 표시도 내린다 (휴지통 판이 최종본으로 남지 않게)
      ...(trashed ? { isFinal: false } : {}),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

export type { DraftKind };
