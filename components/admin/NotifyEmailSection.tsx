"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestTestEmail } from "@/components/notices/requestTestEmail";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { AppError } from "@/lib/domain/errors";

/** 관리자 화면의 "알림 메일": 언제 누구에게 메일이 가는지 안내 + 나에게 테스트 메일 보내기 */
export function NotifyEmailSection() {
  const { user } = useAuth();
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const sendTest = useAsyncAction(async () => {
    if (!user) throw new AppError("signed-out", "로그인이 풀렸습니다. 다시 로그인한 뒤 눌러 주세요.");
    return requestTestEmail(user);
  });

  async function handleSend() {
    setSentMessage(null);
    const result = await sendTest.run();
    if (result.ok) setSentMessage(result.value);
  }

  return (
    <Section
      tile
      title="알림 메일"
      description="매일 오전 9시쯤 관리자 Gmail 계정에서 자동으로 보냅니다. 알릴 내용이 없는 사람에게는 보내지 않습니다."
    >
      <div className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink">
          <li>
            <span className="font-semibold">내일 강의</span> — 강의 전날, 그 과정의 담당 강사에게 보냅니다.
          </li>
          <li>
            <span className="font-semibold">미입금 강사료</span> — 입금 예정일 다음 날 처음 보내고, 입금일을 적을 때까지
            7일마다 다시 보냅니다. 그 강사 본인과 모든 관리자가 받습니다.
          </li>
          <li>팀에서 내보낸 사람에게는 보내지 않습니다. 같은 내용은 머리글의 종 버튼과 홈 화면에도 보입니다.</li>
        </ul>

        <div className="flex flex-col gap-2 sm:max-lg:flex-row sm:max-lg:items-center sm:max-lg:gap-4">
          <Button
            variant="outline"
            className="self-start"
            loading={sendTest.pending}
            loadingLabel="테스트 메일을 보내는 중"
            onClick={handleSend}
          >
            나에게 테스트 메일 보내기
          </Button>
          <p className="text-sm text-muted">
            메일 설정(Vercel 환경 변수)이 맞는지 확인할 때 씁니다. 내 이메일로 한 통만 갑니다.
          </p>
        </div>

        {sentMessage ? (
          <Alert tone="success" title="테스트 메일을 보냈습니다">
            {sentMessage}
          </Alert>
        ) : null}
        {sendTest.error ? (
          <Alert tone="error" title="테스트 메일을 보내지 못했습니다">
            {sendTest.error}
          </Alert>
        ) : null}
      </div>
    </Section>
  );
}
