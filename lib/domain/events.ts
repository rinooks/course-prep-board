// 과정 일정 (PRD F8, 가정 A9): 강의 회차 말고 리허설·회의 같은 준비 일정.

export const EVENT_KINDS = ["rehearsal", "meeting"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  rehearsal: "리허설",
  meeting: "회의",
};

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === "string" && (EVENT_KINDS as readonly string[]).includes(value);
}
