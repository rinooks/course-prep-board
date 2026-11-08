// 강사료(fees) 읽기·쓰기. 최상위 컬렉션 fees/{feeId}.
// - 금액은 강사 본인과 관리자만 본다. 보안 규칙이 다른 사람 것을 막으므로,
//   강사는 쿼리도 "내 것"으로 좁혀야 한다 (규칙은 쿼리 조건으로 통과 여부를 판단한다).
// - 한 과정에 여러 건(회차별·선금·잔금)을 둘 수 있다.

import { deleteDoc, query, serverTimestamp, setDoc, updateDoc, where, type Query } from "firebase/firestore";
import { createId } from "@/lib/domain/ids";
import { validateFeeInput, validateFeePatch } from "@/lib/domain/validation";
import { topCol, topDoc } from "./refs";
import { toFee } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type { CreateOptions, DateString, ErrorHandler, Fee, FeeInput, FeeUpdateInput, Unsubscribe } from "./types";

export interface FeeScope {
  /** 지금 로그인한 사람 (소문자 이메일) */
  email: string;
  /** 관리자는 모든 강사의 강사료를 본다 */
  isAdmin: boolean;
  /** 주면 이 과정의 강사료만 */
  courseId?: string;
}

function feesQuery(scope: FeeScope): Query {
  const filters = [];
  if (scope.courseId) filters.push(where("courseId", "==", scope.courseId));
  if (!scope.isAdmin) filters.push(where("instructorEmail", "==", scope.email));
  return query(topCol("fees"), ...filters);
}

/**
 * 강사료 구독. 관리자는 전체(또는 과정 전체), 강사는 자기 것만.
 * 순서는 화면에서 sortFees(fees, today)로 정한다 (오늘 날짜에 따라 달라지므로).
 */
export function subscribeFees(scope: FeeScope, onData: (fees: Fee[]) => void, onError: ErrorHandler): Unsubscribe {
  return listenQuery(() => feesQuery(scope), toFee, onData, onError);
}

/** 강사료 추가. 강사는 자기 강사료만, 관리자는 누구의 것이든 만든다. 돌려주는 값: 강사료 id */
export async function createFee(input: FeeInput, options: CreateOptions = {}): Promise<string> {
  const check = validateFeeInput({
    courseId: input.courseId,
    instructorEmail: input.instructorEmail,
    label: input.label ?? "",
    amount: input.amount,
    dueDate: input.dueDate,
    paidDate: input.paidDate ?? null,
    memo: input.memo ?? "",
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const feeId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(topDoc("fees", feeId), {
        ...check.value,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `fee:create:${feeId}`,
  );
  return feeId;
}

/** 강사료 고치기. 바꿀 칸만 넣는다 (과정·강사는 못 바꾼다) */
export async function updateFee(feeId: string, patch: FeeUpdateInput): Promise<void> {
  const check = validateFeePatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(topDoc("fees", feeId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 입금 확인(입금일 기록) 또는 취소(null) */
export function setFeePaid(feeId: string, paidDate: DateString | null): Promise<void> {
  return updateFee(feeId, { paidDate });
}

/** 강사료 지우기 (바로 삭제. 잘못 넣은 건을 정리할 때) */
export async function deleteFee(feeId: string): Promise<void> {
  await runWrite(() => deleteDoc(topDoc("fees", feeId)));
}
