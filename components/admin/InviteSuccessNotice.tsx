"use client";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "./copyText";

/** 초대가 끝났을 때 보여주는 안내. 초대 메일이 따로 가지 않으므로 앱 주소를 복사해 전하게 돕는다. */
export function InviteSuccessNotice({ email }: { email: string }) {
  const toast = useToast();

  async function copyAppAddress() {
    const address = window.location.origin;
    const copied = await copyText(address);
    if (copied) {
      toast.success("앱 주소를 복사했습니다. 초대한 분께 메신저나 메일로 보내 주세요.");
    } else {
      toast.error(`자동 복사가 막혀 있습니다. 이 주소를 직접 복사해 보내 주세요: ${address}`);
    }
  }

  return (
    <Alert
      tone="success"
      title="초대했습니다"
      action={
        <Button variant="outline" size="sm" onClick={copyAppAddress}>
          앱 주소 복사
        </Button>
      }
    >
      <span className="break-anywhere font-semibold">{email}</span> 계정으로 구글 로그인하면 바로 들어올 수
      있습니다. 초대 메일은 따로 가지 않으니 앱 주소를 직접 알려 주세요.
    </Alert>
  );
}
