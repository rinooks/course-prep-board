"use client";

import type { ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useAsyncAction } from "./useAsyncAction";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** 확인을 눌렀을 때 실행. 성공하면 창이 닫히고, 실패하면 창 안에 안내가 뜬다 */
  onConfirm: () => Promise<unknown> | void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger면 확인 버튼이 빨간색 */
  tone?: "default" | "danger";
}

/** "정말 ~할까요?" 확인 창 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "default",
}: ConfirmDialogProps) {
  const action = useAsyncAction(async () => {
    await onConfirm();
  });

  function close() {
    if (action.pending) return;
    action.reset();
    onClose();
  }

  async function confirm() {
    const result = await action.run();
    if (result.ok) {
      action.reset();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={action.pending}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "solid"} loading={action.pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {description ? <div className="text-base leading-relaxed text-ink">{description}</div> : null}
        {action.error ? <Alert tone="error">{action.error}</Alert> : null}
      </div>
    </Modal>
  );
}
