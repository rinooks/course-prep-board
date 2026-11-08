"use client";

// 받아쓰기 버튼 묶음: 시작·멈추기, 듣는 중 표시, 말하는 중인 글 미리보기, 안내·오류.
// 확정된 글은 onText로 넘겨 재료 본문 뒤에 붙는다 (본문은 그대로 고칠 수 있다).

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MicIcon } from "@/components/ui/icons";
import { useSpeechRecognition } from "./useSpeechRecognition";

interface DictationControlProps {
  onText: (text: string) => void;
  /** 저장 중 등으로 잠시 막을 때 */
  disabled?: boolean;
}

export function DictationControl({ onText, disabled = false }: DictationControlProps) {
  const speech = useSpeechRecognition(onText);

  if (!speech.supported) {
    return (
      <Alert tone="warning" title="이 브라우저는 받아쓰기를 지원하지 않습니다">
        크롬이나 엣지에서 열면 말하는 대로 글자가 들어갑니다. 지금은 휴대폰 녹음 앱(클로바노트, 갤럭시 녹음 등)이
        바꿔 준 글을 아래 칸에 붙여 넣어 주세요.
      </Alert>
    );
  }

  return (
    <Card padding="sm" flat tone="surface" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {speech.listening ? (
          <Button variant="danger" size="sm" onClick={speech.stop}>
            <MicIcon />
            받아쓰기 멈추기
          </Button>
        ) : (
          <Button size="sm" onClick={speech.start} disabled={disabled}>
            <MicIcon />
            받아쓰기 시작
          </Button>
        )}
        <p className="text-sm text-muted" aria-live="polite">
          {speech.listening ? (
            <span className="inline-flex items-center gap-2 font-semibold text-danger">
              <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
              듣는 중입니다. 말이 끝나면 아래 칸에 글자가 붙습니다.
            </span>
          ) : (
            "버튼을 누르고 말하면 아래 칸에 글자가 이어 붙습니다. 처음에는 마이크 사용을 허용해 달라는 창이 뜹니다."
          )}
        </p>
      </div>
      {speech.interim ? (
        <p className="text-sm text-muted">
          <span className="font-semibold">듣고 있는 말: </span>
          {speech.interim}
        </p>
      ) : null}
      {speech.error ? <Alert tone="error" title="받아쓰기가 멈췄습니다">{speech.error}</Alert> : null}
      <p className="text-sm text-muted">
        말한 소리는 브라우저 회사(구글·애플)의 음성 인식 서비스를 거쳐 글자로 바뀝니다. 고객사 기밀 회의는 받아쓰기 대신
        직접 정리해 붙여 넣어 주세요.
      </p>
    </Card>
  );
}
