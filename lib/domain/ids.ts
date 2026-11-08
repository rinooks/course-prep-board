// 문서 id를 브라우저에서 미리 만든다.
// 저장이 늦어 사용자가 "다시 시도"를 눌러도 같은 id로 다시 보내므로 문서가 두 개 생기지 않는다.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// 256을 62로 나눈 나머지 때문에 생기는 쏠림을 막으려고 248 이상 값은 버린다.
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

export const ID_LENGTH = 20;

export function createId(length: number = ID_LENGTH): string {
  const result: string[] = [];
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= UNBIASED_LIMIT) continue;
      result.push(ALPHABET[byte % ALPHABET.length]);
      if (result.length === length) break;
    }
  }
  return result.join("");
}

/** Firestore 문서 id로 써도 되는 값인지 (우리 규칙: 영문·숫자·_- 1~128자) */
export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
