"use client";

// 관리자 화면의 "나에게 테스트 메일 보내기" 요청 (서버: app/api/notify/test).
// 로그인 증표(ID 토큰)만 보내고, 받는 주소는 서버가 증표에서 꺼낸다.

import type { User } from "firebase/auth";
import { AppError } from "@/lib/domain/errors";

/** 서버가 Gmail에 연결하는 시간까지 생각해 넉넉히 둔다 */
const REQUEST_TIMEOUT_MS = 30_000;

interface TestEmailResponse {
  ok?: boolean;
  message?: string;
  error?: string;
}

/** 성공하면 화면에 보여 줄 문구를 돌려준다. 실패하면 AppError (message가 곧 안내 문구) */
export async function requestTestEmail(user: Pick<User, "getIdToken">): Promise<string> {
  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch("/api/notify/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AppError(
        "timeout",
        "서버 응답이 30초 넘게 없습니다. 메일이 이미 갔을 수 있으니 받은편지함을 먼저 확인하고, 없으면 잠시 뒤 다시 눌러 주세요.",
      );
    }
    throw new AppError("unavailable", "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.");
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => null)) as TestEmailResponse | null;
  if (!response.ok || !body?.ok) {
    throw new AppError(
      "notify-test-failed",
      body?.error ?? `테스트 메일을 보내지 못했습니다 (응답 ${response.status}). 잠시 뒤 다시 눌러 주세요.`,
    );
  }
  return body.message ?? "테스트 메일을 보냈습니다. 받은편지함을 확인해 주세요.";
}
