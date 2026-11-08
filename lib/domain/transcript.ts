// 받아쓰기 글 이어 붙이기. 순수 함수.

/** 받아쓴 한 덩어리를 지금까지의 글 뒤에 붙인다. 줄이 끝났으면 바로, 아니면 한 칸 띄워 붙인다 */
export function appendTranscript(body: string, chunk: string): string {
  const text = chunk.trim();
  if (text.length === 0) return body;
  if (body.length === 0) return text;
  if (/\s$/.test(body)) return `${body}${text}`;
  return `${body} ${text}`;
}
