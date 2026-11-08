"use client";

// "단계 이동" 메뉴: 단계를 골라 "옮기기"를 누르면 그 단계 맨 아래로 옮긴다.
// 휴대폰에서는 끌기보다 이 메뉴가 기본 방법이다. 고르기만 해서는 옮기지 않는다
// (키보드 화살표로 목록을 훑다가 실수로 옮기는 일을 막는다).

import { useId, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Label } from "@/components/ui/Field";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useToast } from "@/components/ui/Toast";
import { moveCard } from "@/lib/data/cards";
import type { Card } from "@/lib/data/types";
import { visibleCards } from "@/lib/domain/board";
import { isStageId, STAGES, stageLabel, type StageId } from "@/lib/domain/stages";

interface StageMoveControlProps {
  courseId: string;
  card: Card;
  /** 과정의 모든 카드 (옮겨 갈 단계의 순서를 계산한다) */
  cards: readonly Card[];
}

export function StageMoveControl({ courseId, card, cards }: StageMoveControlProps) {
  const selectId = useId();
  const toast = useToast();
  const [target, setTarget] = useState<StageId | "">("");

  const moveToEnd = useAsyncAction((toStage: StageId) => {
    const siblings = visibleCards(cards)
      .filter((item) => item.stage === toStage && item.id !== card.id)
      .map((item) => ({ id: item.id, order: item.order }));
    return moveCard(courseId, card.id, toStage, siblings, siblings.length);
  });

  async function handleMove() {
    if (!target || target === card.stage) return;
    const result = await moveToEnd.run(target);
    if (result.ok) {
      toast.success(`'${stageLabel(target)}' 단계 맨 아래로 옮겼습니다.`);
      setTarget("");
    }
  }

  const options = STAGES.map((stage) => ({
    value: stage.id,
    label: stage.id === card.stage ? `${stage.order}. ${stage.label} (지금 단계)` : `${stage.order}. ${stage.label}`,
    disabled: stage.id === card.stage,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={selectId}>단계 이동</Label>
      <div className="flex gap-2">
        <Select
          id={selectId}
          value={target}
          placeholder="옮길 단계 고르기"
          options={options}
          onChange={(event) => {
            moveToEnd.reset();
            setTarget(isStageId(event.target.value) ? event.target.value : "");
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleMove}
          disabled={!target}
          loading={moveToEnd.pending}
          loadingLabel="옮기는 중"
        >
          옮기기
        </Button>
      </div>
      {moveToEnd.error ? <Alert tone="error">{moveToEnd.error}</Alert> : null}
    </div>
  );
}
