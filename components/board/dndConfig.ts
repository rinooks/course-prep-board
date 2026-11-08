// 칸반 끌어서 옮기기(@dnd-kit 0.5) 설정: 마우스·터치·키보드 감지 방식과 화면 낭독기 안내 문구.
// DragDropProvider가 처음 만들어질 때 한 번만 읽으므로 모듈 상수로 둔다.

import { PointerSensor } from "@dnd-kit/react";
import {
  Accessibility,
  PointerActivationConstraints,
  type DragDropManager,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Sensors,
} from "@dnd-kit/dom";
import type { Plugins } from "@dnd-kit/abstract";
import { isSortable } from "@dnd-kit/react/sortable";
import { isStageId, stageLabel } from "@/lib/domain/stages";

/** 드래그 대상 종류. 카드와 칸(단계) 사이에서만 주고받는다 */
export const CARD_TYPE = "card";
export const COLUMN_TYPE = "column";

/** 이 속성이 붙은 요소(완료 버튼 등) 위에서 누르면 끌기를 시작하지 않는다 */
export const NO_DRAG_ATTRIBUTE = "data-no-drag";

export interface CardDragData {
  title: string;
  [key: string]: unknown;
}

const pointer = PointerSensor.configure({
  // 손잡이뿐 아니라 카드 어디를 잡아도 끌 수 있다
  activatorElements: (source) => [source.element],
  activationConstraints(event) {
    if (event.pointerType === "touch") {
      // 휴대폰: 길게(0.25초) 눌러야 끌린다. 그냥 밀면 화면이 스크롤된다
      return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })];
    }
    // 마우스: 5px 이상 움직여야 끌린다. 그냥 누르면 카드가 열린다
    return [new PointerActivationConstraints.Distance({ value: 5 })];
  },
  preventActivation(event) {
    const target = event.target;
    return target instanceof Element && target.closest(`[${NO_DRAG_ATTRIBUTE}]`) !== null;
  },
});

/**
 * 기본 감지기 중 포인터만 위 설정으로 바꾼다.
 * 키보드 감지기(KeyboardSensor)는 그대로 둔다: 손잡이 버튼에서 스페이스·엔터로 들고,
 * 화살표로 옮기고, 다시 스페이스·엔터로 놓는다.
 */
export function boardSensors(defaults: Sensors): Sensors {
  return [...defaults.filter((sensor) => sensor !== PointerSensor), pointer];
}

function titleOf(data: unknown): string {
  if (data && typeof data === "object" && "title" in data) {
    const title = (data as { title: unknown }).title;
    if (typeof title === "string" && title.length > 0) return `"${title}" 카드`;
  }
  return "카드";
}

function placeLabel(group: unknown, index: number): string {
  const stage = isStageId(group) ? `${stageLabel(group)} 단계` : "다른 단계";
  return `${stage} ${index + 1}번째 자리`;
}

const accessibility = Accessibility.configure({
  screenReaderInstructions: {
    draggable:
      "카드를 옮기려면 스페이스 바를 누르세요. 화살표 키로 자리를 옮기고, 스페이스 바를 다시 누르면 내려놓습니다. Esc 키를 누르면 취소합니다.",
  },
  announcements: {
    dragstart(event: DragStartEvent) {
      const { source } = event.operation;
      if (!source) return undefined;
      return `${titleOf(source.data)}를 들었습니다.`;
    },
    dragover(event: DragOverEvent) {
      const { source } = event.operation;
      if (!source || !isSortable(source)) return undefined;
      return `${titleOf(source.data)}: ${placeLabel(source.group, source.index)}`;
    },
    dragend(event: DragEndEvent) {
      const { source } = event.operation;
      if (!source) return undefined;
      if (event.canceled) return `옮기기를 취소했습니다. ${titleOf(source.data)}는 원래 자리에 있습니다.`;
      if (isSortable(source)) {
        return `${titleOf(source.data)}를 ${placeLabel(source.group, source.index)}에 놓았습니다.`;
      }
      return `${titleOf(source.data)}를 놓았습니다.`;
    },
  },
});

export function boardPlugins(defaults: Plugins<DragDropManager>): Plugins<DragDropManager> {
  return [...defaults, accessibility];
}
