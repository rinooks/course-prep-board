// 알림 메일 서버 쪽 순수 함수: 크론 인증, 보낸 기록 id, 서비스 계정 읽기, 요청 막이, 오류 문구, 문서 읽기
import { describe, expect, it } from "vitest";
import { bearerToken, checkCronAuth, safeEqual } from "@/lib/server/cronAuth";
import {
  describeForLog,
  describeMailError,
  RequestError,
  ServerSetupError,
  toHttpError,
} from "@/lib/server/errors";
import { emailHash, mailLogCutoff, mailLogId } from "@/lib/server/mailLog";
import { courseFromData, feeFromData, memberFromData, sessionFromData } from "@/lib/server/records";
import { createThrottle, isAllowedOrigin, jsonResponse } from "@/lib/server/requestGuards";
import { parseServiceAccount } from "@/lib/server/serviceAccount";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("크론 인증", () => {
  it("CRON_SECRET이 없으면 not-configured, 짧으면 weak-secret", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, undefined)).toBe("not-configured");
    expect(checkCronAuth(`Bearer ${SECRET}`, "")).toBe("not-configured");
    expect(checkCronAuth(`Bearer ${SECRET}`, "   ")).toBe("not-configured");
    expect(checkCronAuth("Bearer short", "short")).toBe("weak-secret");
  });

  it("머리글이 정확히 'Bearer <비밀값>'일 때만 ok", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe("ok");
    expect(checkCronAuth(null, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(SECRET, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Bearer ${SECRET}x`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`bearer ${SECRET.toUpperCase()}`, SECRET)).toBe("unauthorized");
  });

  it("safeEqual은 길이가 달라도 오류 없이 false", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });

  it("bearerToken은 'Bearer <값>' 형식에서 값만 꺼낸다", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("보낸 기록(mailLog) id", () => {
  it("날짜_이메일 해시 16자리. 대소문자·앞뒤 공백이 달라도 같은 id, 이메일 원문은 들어가지 않는다", () => {
    const id = mailLogId("2026-10-12", "Kim@Example.com ");
    expect(id).toMatch(/^2026-10-12_[0-9a-f]{16}$/);
    expect(id).toBe(mailLogId("2026-10-12", "kim@example.com"));
    expect(id).not.toContain("kim");
    expect(emailHash("kim@example.com")).not.toBe(emailHash("lee@example.com"));
    expect(mailLogId("2026-10-13", "kim@example.com")).not.toBe(id);
  });

  it("30일보다 오래된 기록을 지운다", () => {
    expect(mailLogCutoff("2026-10-12")).toBe("2026-09-12");
  });
});

describe("서비스 계정 키 읽기", () => {
  const key = {
    type: "service_account",
    project_id: "edu-project-f1d12",
    client_email: "firebase-adminsdk@edu-project-f1d12.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
  };

  it("JSON 그대로, 또는 base64로 넣은 값을 읽는다", () => {
    const raw = JSON.stringify(key);
    const expected = {
      projectId: "edu-project-f1d12",
      clientEmail: key.client_email,
      privateKey: key.private_key.trim(),
    };
    expect(parseServiceAccount(raw)).toEqual(expected);
    expect(parseServiceAccount(Buffer.from(raw).toString("base64"))).toEqual(expected);
  });

  it("줄바꿈이 '\\n' 글자로 들어온 비밀키를 실제 줄바꿈으로 되돌린다", () => {
    const raw = JSON.stringify({ ...key, private_key: "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----" });
    expect(parseServiceAccount(raw).privateKey).toBe("-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----");
  });

  it("비었거나 이상하면 설정 오류. 문구에 넣은 값을 담지 않는다", () => {
    expect(() => parseServiceAccount(undefined)).toThrow(ServerSetupError);
    expect(() => parseServiceAccount("")).toThrow(/FIREBASE_SERVICE_ACCOUNT/);

    const secretLooking = "my-secret-value-123";
    try {
      parseServiceAccount(secretLooking);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ServerSetupError);
      expect((error as Error).message).not.toContain(secretLooking);
    }

    expect(() => parseServiceAccount("{not json")).toThrow(ServerSetupError);
    expect(() => parseServiceAccount("[]")).toThrow(ServerSetupError);
    expect(() => parseServiceAccount(JSON.stringify({ ...key, private_key: "" }))).toThrow(/private_key/);
  });
});

describe("같은 사이트 요청 확인", () => {
  it("Origin이 서버 주소(Host)와 같으면 통과", () => {
    expect(isAllowedOrigin("https://edu-project-beta.vercel.app", "edu-project-beta.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("다른 사이트, Origin 없음, 암호화 안 된 외부 주소, 이상한 값은 거절", () => {
    expect(isAllowedOrigin("https://evil.example.com", "edu-project-beta.vercel.app")).toBe(false);
    expect(isAllowedOrigin(null, "edu-project-beta.vercel.app")).toBe(false);
    expect(isAllowedOrigin("http://edu-project-beta.vercel.app", "edu-project-beta.vercel.app")).toBe(false);
    expect(isAllowedOrigin("null", "edu-project-beta.vercel.app")).toBe(false);
  });

  it("허용 목록에 있는 주소는 Host가 달라도 통과", () => {
    expect(
      isAllowedOrigin("https://edu-project-beta.vercel.app", "internal-host", ["https://edu-project-beta.vercel.app"]),
    ).toBe(true);
  });
});

describe("횟수 제한", () => {
  it("1분에 한 번. 실패해서 release하면 바로 다시 할 수 있다", () => {
    const throttle = createThrottle(60_000);
    expect(throttle.take("a", 0)).toEqual({ ok: true });
    expect(throttle.take("a", 10_000)).toEqual({ ok: false, retryAfterMs: 50_000 });
    expect(throttle.take("b", 10_000)).toEqual({ ok: true });
    expect(throttle.take("a", 60_000)).toEqual({ ok: true });
    throttle.release("a");
    expect(throttle.take("a", 61_000)).toEqual({ ok: true });
  });

  it("기억하는 수를 넘으면 오래된 것부터 잊는다", () => {
    const throttle = createThrottle(60_000, 2);
    throttle.take("a", 0);
    throttle.take("b", 0);
    throttle.take("c", 0);
    expect(throttle.take("a", 1).ok).toBe(true);
    expect(throttle.take("c", 1).ok).toBe(false);
  });
});

describe("응답과 오류 문구", () => {
  it("JSON 응답은 저장(캐시)하지 않는다", async () => {
    const response = jsonResponse(200, { ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("Gmail 로그인 실패는 어떤 환경 변수를 볼지 알려 준다", () => {
    const error = Object.assign(new Error("Invalid login"), { code: "EAUTH" });
    expect(describeMailError(error)).toContain("GMAIL_APP_PASSWORD");
    expect(toHttpError(error).status).toBe(502);
  });

  it("오류 종류별 상태 번호", () => {
    expect(toHttpError(new RequestError(429, "잠시 뒤에"))).toEqual({ status: 429, message: "잠시 뒤에" });
    expect(toHttpError(new ServerSetupError("x", "설정 필요")).status).toBe(500);
    expect(toHttpError({ code: "auth/id-token-expired" })).toEqual({
      status: 401,
      message: "로그인 정보가 만료되었습니다. 페이지를 새로고침한 뒤 다시 눌러 주세요.",
    });
    expect(toHttpError({ code: "auth/argument-error" }).message).toContain("FIREBASE_SERVICE_ACCOUNT");
    expect(toHttpError({ code: 7 }).message).toContain("edu-project-f1d12");
    expect(toHttpError({ code: 14 }).status).toBe(503);
    expect(toHttpError(new Error("??")).status).toBe(500);
  });

  it("기록용 문구에서 이메일 주소를 가린다", () => {
    const line = describeForLog(Object.assign(new Error("Recipient kim@example.com rejected"), { code: "EENVELOPE" }));
    expect(line).not.toContain("kim@example.com");
    expect(line).toContain("<email>");
    expect(line).toContain("code=EENVELOPE");
  });
});

describe("서버에서 읽은 문서 바꾸기", () => {
  it("빠진 값은 안전한 기본값, 이메일은 소문자", () => {
    expect(memberFromData("Kim@Example.com", { role: "boss" })).toEqual({
      email: "kim@example.com",
      role: "instructor",
      displayName: "",
    });
    expect(
      courseFromData("c1", { title: "과정", instructorEmails: ["Kim@Example.com", 3], deletedAt: { toMillis: () => 5 } }),
    ).toEqual({ id: "c1", title: "과정", client: "", instructorEmails: ["kim@example.com"], status: "active", deletedAt: 5 });
    expect(courseFromData("c2", { deletedAt: null, status: "archived" }).deletedAt).toBeNull();
    expect(sessionFromData("s1", { date: "2026-10-13", startTime: "" })).toEqual({
      id: "s1",
      date: "2026-10-13",
      startTime: null,
      location: "",
      audience: "",
    });
    expect(feeFromData("f1", { amount: -5, paidDate: "2026-99-99", instructorEmail: "Lee@Example.com" })).toMatchObject({
      amount: 0,
      paidDate: null,
      instructorEmail: "lee@example.com",
    });
  });
});

describe("ID 토큰 확인 (구글 로그인 서버에 묻기)", () => {
  async function importLookup() {
    return (await import("@/lib/server/idToken")).lookupIdToken;
  }

  function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}): typeof fetch {
    return (async (url: string | URL | Request, init?: RequestInit) => {
      seen.url = String(url);
      seen.init = init;
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
  }

  it("통과하면 소문자 이메일과 인증 여부를 돌려주고, 키·토큰·Referer를 보낸다", async () => {
    const lookupIdToken = await importLookup();
    const seen: { url?: string; init?: RequestInit } = {};
    const result = await lookupIdToken("token-abc", {
      apiKey: "web-key",
      referer: "https://edu-project-beta.vercel.app/",
      fetchImpl: fakeFetch(200, { users: [{ email: "Admin@Example.com", emailVerified: true }] }, seen),
    });
    expect(result).toEqual({ email: "admin@example.com", emailVerified: true });
    expect(seen.url).toContain("accounts:lookup?key=web-key");
    expect(JSON.parse(String(seen.init?.body))).toEqual({ idToken: "token-abc" });
    expect((seen.init?.headers as Record<string, string>).Referer).toBe("https://edu-project-beta.vercel.app/");
  });

  it("만료·위조 토큰은 401로 다시 로그인을 안내한다", async () => {
    const lookupIdToken = await importLookup();
    for (const code of ["INVALID_ID_TOKEN", "TOKEN_EXPIRED", "USER_DISABLED"]) {
      await expect(
        lookupIdToken("bad", { apiKey: "k", fetchImpl: fakeFetch(400, { error: { message: code } }) }),
      ).rejects.toMatchObject({ status: 401 });
    }
    await expect(lookupIdToken("t", { apiKey: "k", fetchImpl: fakeFetch(200, { users: [] }) })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("구글 서버 오류는 502, 연결 실패·시간 초과는 503", async () => {
    const lookupIdToken = await importLookup();
    await expect(
      lookupIdToken("t", { apiKey: "k", fetchImpl: fakeFetch(500, { error: { message: "INTERNAL" } }) }),
    ).rejects.toMatchObject({ status: 502 });
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(lookupIdToken("t", { apiKey: "k", fetchImpl: failing })).rejects.toMatchObject({ status: 503 });
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch;
    await expect(lookupIdToken("t", { apiKey: "k", fetchImpl: hanging, timeoutMs: 20 })).rejects.toMatchObject({
      status: 503,
    });
  });

  it("API 키가 없으면 설정 오류", async () => {
    const lookupIdToken = await importLookup();
    await expect(lookupIdToken("t", { apiKey: "  " })).rejects.toBeInstanceOf(ServerSetupError);
  });
});
