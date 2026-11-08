import type { KeyboardEvent } from "react";
import { isImeComposing } from "./ime";

/**
 * <form onKeyDown={blockImeEnterSubmit}> 로 붙인다.
 * 한 줄 입력칸에서 한글 조합을 확정하는 Enter로 폼이 제출되지 않게 막는다.
 * 여러 줄 칸(textarea)의 Enter는 그대로 둔다.
 */
export function blockImeEnterSubmit(event: KeyboardEvent<HTMLFormElement>): void {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement && isImeComposing(event)) {
    event.preventDefault();
  }
}
