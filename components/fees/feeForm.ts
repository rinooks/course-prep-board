// 강사료 추가·고치기 창의 입력 상태와 저장 값 만들기 (순수 함수, tests/unit/fee-display.test.ts가 검사한다).
// 금액 칸은 글자 그대로 들고 있다가 저장할 때 데이터 계층이 parseWon으로 읽는다 ("1,200,000"도 된다).

import type { Fee, FeeInput, FeeUpdateInput } from "@/lib/data/types";
import type { DateString } from "@/lib/domain/dates";
import { formatAmountInput, parseWon } from "@/lib/domain/fees";
import type { FieldErrors } from "@/lib/domain/validation";

export interface FeeDraft {
  instructorEmail: string;
  label: string;
  /** 금액 칸 글자 그대로 ("1,200,000") */
  amount: string;
  dueDate: string;
  /** "이미 입금됨" 체크 */
  paid: boolean;
  paidDate: string;
  memo: string;
}

/** 새 강사료의 처음 값 */
export function newFeeDraft(instructorEmail: string, dueDate: DateString): FeeDraft {
  return {
    instructorEmail,
    label: "",
    amount: "",
    dueDate,
    paid: false,
    paidDate: "",
    memo: "",
  };
}

/** 고칠 강사료의 처음 값 */
export function feeDraftFrom(fee: Fee): FeeDraft {
  return {
    instructorEmail: fee.instructorEmail,
    label: fee.label,
    amount: fee.amount > 0 ? formatAmountInput(fee.amount) : "",
    dueDate: fee.dueDate,
    paid: fee.paidDate !== null,
    paidDate: fee.paidDate ?? "",
    memo: fee.memo,
  };
}

/** 금액 칸에서 나갈 때 보기 좋게 다시 쓴다: "1200000" → "1,200,000". 숫자가 아니면 그대로 둔다 (검사에서 안내) */
export function tidyAmountInput(raw: string): string {
  const value = parseWon(raw);
  return value === null ? raw : formatAmountInput(value);
}

/** 금액 칸 아래 미리 보기용 숫자. 읽을 수 없으면 null */
export function previewAmount(raw: string): number | null {
  const value = parseWon(raw);
  return value !== null && value > 0 ? value : null;
}

/** 입금일 값: "이미 입금됨"을 껐으면 null */
function paidDateOf(draft: FeeDraft): string | null {
  return draft.paid ? draft.paidDate : null;
}

/**
 * 데이터 계층 검사 전에 화면에서만 알 수 있는 실수를 잡는다.
 * "이미 입금됨"을 켜고 입금일을 비우면, 그대로 보내면 입금 전으로 저장되므로 막는다.
 */
export function feeDraftErrors(draft: FeeDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.paid && draft.paidDate.trim().length === 0) {
    errors.paidDate = "입금일을 골라 주세요. 아직 입금 전이면 '이미 입금됨' 체크를 꺼 주세요.";
  }
  return errors;
}

/** 새 강사료 저장 값 */
export function toFeeInput(draft: FeeDraft, courseId: string): FeeInput {
  return {
    courseId,
    instructorEmail: draft.instructorEmail,
    label: draft.label,
    amount: draft.amount,
    dueDate: draft.dueDate,
    paidDate: paidDateOf(draft),
    memo: draft.memo,
  };
}

/** 금액이 바뀌었는지. 둘 다 숫자로 읽히면 값으로 비교한다 ("1200000"과 "1,200,000"은 같다) */
function amountChanged(initial: string, current: string): boolean {
  const before = parseWon(initial);
  const after = parseWon(current);
  if (before !== null && after !== null) return before !== after;
  return initial !== current;
}

/**
 * 처음 값과 달라진 칸만 (고치기용). 다른 사람이 그사이 고친 칸을 덮어쓰지 않는다.
 * 받는 강사는 바꿀 수 없어 넣지 않는다.
 */
export function changedFeeFields(initial: FeeDraft, current: FeeDraft): FeeUpdateInput {
  const patch: FeeUpdateInput = {};
  if (current.label !== initial.label) patch.label = current.label;
  if (amountChanged(initial.amount, current.amount)) patch.amount = current.amount;
  if (current.dueDate !== initial.dueDate) patch.dueDate = current.dueDate;
  const initialPaid = paidDateOf(initial);
  const currentPaid = paidDateOf(current);
  if (currentPaid !== initialPaid) patch.paidDate = currentPaid;
  if (current.memo !== initial.memo) patch.memo = current.memo;
  return patch;
}
