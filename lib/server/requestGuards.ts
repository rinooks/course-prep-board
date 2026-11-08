// 요청 막이 (순수 함수, 단위 테스트 대상)
// - 같은 사이트 확인: 다른 사이트 화면이 우리 서버로 요청을 보내지 못하게 Origin 머리글을 본다.
// - 횟수 제한: 같은 사람이 테스트 메일 버튼을 연달아 눌러 메일이 쏟아지지 않게 한다.

/**
 * Origin 머리글이 이 서버 주소(Host 머리글)이거나 allowedOrigins 중 하나인지.
 * Origin이 없으면 거절한다 (브라우저는 POST 요청에 항상 Origin을 붙인다).
 */
export function isAllowedOrigin(
  origin: string | null | undefined,
  host: string | null | undefined,
  allowedOrigins: readonly string[] = [],
): boolean {
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) return false;
  if (host && parsed.host === host.trim().toLowerCase()) return true;
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}

export interface Throttle {
  /** 허용이면 { ok: true }, 아니면 다시 할 수 있을 때까지 남은 밀리초 */
  take(key: string, nowMs: number): { ok: true } | { ok: false; retryAfterMs: number };
  /** 작업이 실패했을 때 바로 다시 할 수 있게 기록을 지운다 */
  release(key: string): void;
}

/**
 * key마다 windowMs에 한 번. 서버 인스턴스 하나 안에서만 센다 (여러 대가 뜨면 각자 센다).
 * 기억하는 key는 maxKeys개까지 (오래된 것부터 잊는다).
 */
export function createThrottle(windowMs: number, maxKeys = 500): Throttle {
  const lastByKey = new Map<string, number>();
  return {
    take(key, nowMs) {
      const last = lastByKey.get(key);
      if (last !== undefined && nowMs - last < windowMs) {
        return { ok: false, retryAfterMs: windowMs - (nowMs - last) };
      }
      lastByKey.delete(key);
      lastByKey.set(key, nowMs);
      if (lastByKey.size > maxKeys) {
        const oldest = lastByKey.keys().next().value;
        if (oldest !== undefined) lastByKey.delete(oldest);
      }
      return { ok: true };
    },
    release(key) {
      lastByKey.delete(key);
    },
  };
}

/** 응답 머리글 기본 세트: 저장(캐시)하지 않고, 내용 종류를 추측하지 않게 한다 */
export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}
