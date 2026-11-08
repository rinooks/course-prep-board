"use client";

// 결과물 미리보기 창. 확정한 순간의 내용 그대로 보여 준다 (결과물은 고치지 않는다).

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Output } from "@/lib/data/types";
import { OutputContent } from "./OutputContent";
import { outputTitle } from "./outputLabels";

interface OutputPreviewModalProps {
  open: boolean;
  onClose: () => void;
  output: Output;
}

export function OutputPreviewModal({ open, onClose, output }: OutputPreviewModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={outputTitle(output)}
      description="확정한 순간의 내용입니다. 고치려면 초안 탭에서 새 판을 만들어 다시 확정해 주세요."
      footer={
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <OutputContent output={output} />
    </Modal>
  );
}
