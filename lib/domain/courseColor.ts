// 과정 구분 색 고르기. 과정 id로 정하므로 어느 화면에서 보든 같은 과정은 같은 색이다.
// 색은 6개라 과정이 7개 이상이면 같은 색이 겹칠 수 있다. 그래서 색 옆에는 항상 과정 이름을 함께 쓴다.

export const COURSE_COLOR_COUNT = 6;

/** 0 ~ COURSE_COLOR_COUNT-1. 같은 id면 항상 같은 값 */
export function courseColorIndex(courseId: string): number {
  // 간단한 문자열 해시 (FNV-1a). 보안용이 아니라 고르게 나누는 용도다
  let hash = 0x811c9dc5;
  for (let index = 0; index < courseId.length; index += 1) {
    hash ^= courseId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % COURSE_COLOR_COUNT;
}
