// 모든 쓰기가 지나가는 길목: 로그인한 사람 확인, 시간 제한, 같은 작업 중복 실행 막기.

import { AppError } from "@/lib/domain/errors";
import { createIdempotentRunner, withTimeout, WRITE_TIMEOUT_MS } from "@/lib/domain/async";
import { normalizeEmail, type FieldErrors } from "@/lib/domain/validation";
import { getFirebaseAuth } from "@/lib/firebase/client";

const runner = createIdempotentRunner();

/** 지금 로그인한 사람의 소문자 이메일. 로그인이 풀렸으면 AppError("signed-out") */
export function requireActorEmail(): string {
  const user = getFirebaseAuth().currentUser;
  if (!user || !user.email) {
    throw new AppError("signed-out", "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.");
  }
  return normalizeEmail(user.email);
}

/** 지금 로그인한 사람의 uid (파일 저장 위치에 쓴다). 로그인이 풀렸으면 AppError("signed-out") */
export function requireActorUid(): string {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new AppError("signed-out", "로그인이 풀렸습니다. 다시 로그인한 뒤 시도해 주세요.");
  }
  return user.uid;
}

/**
 * 쓰기 실행.
 * - key를 주면 같은 key의 작업이 진행 중이거나 이미 성공했을 때 다시 보내지 않는다 (만들기 작업용).
 * - 10초 안에 서버 확인이 없으면 TimeoutError. 화면에는 toUserMessage(error)를 보여준다.
 */
export function runWrite<T>(task: () => Promise<T>, key?: string): Promise<T> {
  if (key) {
    return runner.run(key, task, WRITE_TIMEOUT_MS);
  }
  // 고치기·지우기는 같은 값을 다시 보내도 결과가 같으므로 시간 제한만 건다.
  return withTimeout(task(), WRITE_TIMEOUT_MS);
}

/** 입력값 검증 실패를 칸별 메시지와 함께 던진다 */
export function throwValidation(errors: FieldErrors): never {
  const first = Object.values(errors).find(Boolean) ?? "입력값을 확인해 주세요.";
  throw new AppError("invalid-input", first, errors);
}
