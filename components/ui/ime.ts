// 한글 입력(IME) 조합 중인지 판별한다.
// 조합 중 Enter는 "글자 확정"용이라, 이때 전송하면 마지막 글자가 잘리거나 두 번 전송된다.

export interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  keyCode?: number;
  isComposing?: boolean;
  nativeEvent?: { isComposing?: boolean };
}

export function isImeComposing(event: KeyEventLike): boolean {
  // Safari 등은 조합을 끝내는 Enter에 isComposing=false, keyCode=229를 준다
  return Boolean(event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229);
}

/** 전송해도 되는 Enter인지: Enter이고, Shift가 없고, 한글 조합 중이 아님 */
export function isSubmitEnter(event: KeyEventLike, options: { allowShift?: boolean } = {}): boolean {
  if (event.key !== "Enter") return false;
  if (isImeComposing(event)) return false;
  if (event.shiftKey && !options.allowShift) return false;
  return true;
}
