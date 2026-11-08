/**
 * 글자를 클립보드에 복사한다. 성공하면 true.
 * http 주소, 권한 거부, 오래된 브라우저에서는 false를 돌려주므로
 * 부른 쪽이 "직접 복사해 주세요" 안내를 띄운다.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
