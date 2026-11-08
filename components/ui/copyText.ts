// 글을 클립보드에 복사한다. 돌려주는 값: 성공 여부.
// 최신 방식(navigator.clipboard)이 막힌 환경(오래된 브라우저, 일부 사내 보안 설정)에서는 옛 방식으로 한 번 더 시도한다.

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 옛 방식으로 다시 시도한다
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
