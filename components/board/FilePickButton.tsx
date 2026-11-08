"use client";

// "파일 첨부" 버튼. 누르면 파일 고르기 창이 열리고, 여러 개를 한 번에 고를 수 있다.
// 실제 파일 칸(input)은 보이지 않게 두고 버튼이 대신 연다 (버튼 모양을 design.md에 맞추려고).
// 고르기 창에서 형식을 미리 거르지 않는다(accept 없음): 휴대폰은 한글(hwp) 같은 형식을 몰라 회색으로 막아 버리고
// 이유도 알려 주지 않는다. 대신 고른 뒤에 checkCardFile이 안 되는 이유를 알려 준다.

import { useRef, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { PaperclipIcon } from "@/components/ui/icons";

interface FilePickButtonProps {
  onPick: (files: File[]) => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function FilePickButton({ onPick, disabled, variant = "outline", size = "sm", children }: FilePickButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // 같은 파일을 빼고 다시 골라도 onChange가 오도록 비운다
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
      <Button variant={variant} size={size} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <PaperclipIcon />
        {children}
      </Button>
    </>
  );
}
