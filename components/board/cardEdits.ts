// 카드 상세에서 "고쳤지만 아직 저장하지 않은 칸"을 다룬다. 순수 함수.
// 고친 칸만 기억해서, 저장할 때 그 칸만 보낸다. 그래서 다른 강사가 그사이 바꾼 다른 칸을 덮어쓰지 않고,
// 손대지 않은 칸은 다른 사람이 바꾸면 화면에 바로 반영된다.

import type { Card, CardUpdateInput } from "@/lib/data/types";

export type CardEditableField = "title" | "assigneeEmail" | "dueDate" | "memo";

/** 고친 칸 → 입력값. 담당자·마감일의 빈 문자열은 "없음"이다 */
export type CardEdits = Partial<Record<CardEditableField, string>>;

/** 카드의 현재 저장값을 입력칸 값(문자열)으로 */
export function savedFieldValue(card: Card, field: CardEditableField): string {
  switch (field) {
    case "title":
      return card.title;
    case "assigneeEmail":
      return card.assigneeEmail ?? "";
    case "dueDate":
      return card.dueDate ?? "";
    case "memo":
      return card.memo;
  }
}

/** 화면에 보일 값: 고친 칸은 고친 값, 아니면 저장값 */
export function displayedFieldValue(card: Card, edits: CardEdits, field: CardEditableField): string {
  const edited = edits[field];
  return edited !== undefined ? edited : savedFieldValue(card, field);
}

/** 칸 하나를 고친다. 저장값과 같아지면 "고침" 표시를 지운다 */
export function withFieldEdit(
  card: Card,
  edits: CardEdits,
  field: CardEditableField,
  value: string,
): CardEdits {
  const next: CardEdits = { ...edits };
  if (value === savedFieldValue(card, field)) {
    delete next[field];
  } else {
    next[field] = value;
  }
  return next;
}

/**
 * 저장이 끝난 뒤 남길 고침: 저장하는 동안 또 고친 칸만 남긴다.
 * saved는 저장 버튼을 누른 순간의 고침이다.
 */
export function withoutSaved(current: CardEdits, saved: CardEdits): CardEdits {
  const next: CardEdits = {};
  for (const field of Object.keys(current) as CardEditableField[]) {
    if (current[field] !== saved[field]) next[field] = current[field];
  }
  return next;
}

export function hasEdits(edits: CardEdits): boolean {
  return Object.keys(edits).length > 0;
}

/** 저장 요청에 넣을 값. 빈 담당자·마감일은 null(없음)로 보낸다 */
export function editsToPatch(edits: CardEdits): CardUpdateInput {
  const patch: CardUpdateInput = {};
  if (edits.title !== undefined) patch.title = edits.title;
  if (edits.memo !== undefined) patch.memo = edits.memo;
  if (edits.assigneeEmail !== undefined) {
    patch.assigneeEmail = edits.assigneeEmail.length > 0 ? edits.assigneeEmail : null;
  }
  if (edits.dueDate !== undefined) {
    patch.dueDate = edits.dueDate.length > 0 ? edits.dueDate : null;
  }
  return patch;
}
