// 한국 날짜가 바뀌는 시점 계산 (순수 함수, 테스트 대상)

const DAY_MS = 24 * 60 * 60 * 1000;
/** 한국은 서머타임이 없어 항상 UTC+9다 */
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/** nowMs(epoch 밀리초)부터 다음 한국 자정까지 남은 밀리초 (1 ~ 하루) */
export function msUntilNextSeoulMidnight(nowMs: number): number {
  const seoulMs = nowMs + SEOUL_OFFSET_MS;
  const elapsedToday = ((seoulMs % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - elapsedToday;
}
