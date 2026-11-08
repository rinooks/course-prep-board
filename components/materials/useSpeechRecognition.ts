"use client";

// 브라우저 받아쓰기 (Web Speech API).
// 크롬·엣지·안드로이드 크롬·아이폰 사파리가 지원한다. 말한 소리는 브라우저 회사(구글·애플)의 음성 인식 서버를 거쳐 글자로 돌아온다.
// 파일 저장소가 없어서 녹음 파일을 올리는 대신, 말하는 동안 바로 글자로 바꿔 재료 글에 붙인다.
//
// 실패 대비:
// - 브라우저가 지원하지 않으면 supported=false (화면에서 붙여 넣기를 안내한다)
// - 크롬은 조용하면 몇 초 뒤 스스로 멈춘다 → 사용자가 멈추지 않았으면 다시 시작한다
// - 짧은 시간에 계속 다시 멈추면(마이크 문제 등) 무한 반복하지 않고 멈춘 뒤 안내한다
// - 화면을 닫으면 듣기를 끝내고 이벤트 연결을 모두 푼다

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}

interface RecognitionErrorEvent {
  error: string;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as Record<string, unknown>).SpeechRecognition
    ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  return typeof candidate === "function" ? (candidate as RecognitionConstructor) : null;
}

/** 이 시간 안에 이만큼 넘게 저절로 멈추면 다시 시작하지 않는다 */
const RESTART_WINDOW_MS = 10_000;
const MAX_RESTARTS_IN_WINDOW = 5;

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed":
    "마이크 사용이 막혀 있습니다. 주소창 왼쪽의 자물쇠(사이트 설정)에서 마이크를 허용한 뒤 다시 눌러 주세요.",
  "service-not-allowed":
    "이 브라우저에서는 받아쓰기를 쓸 수 없습니다. 크롬이나 엣지에서 열거나, 녹음 앱이 바꿔 준 글을 붙여 넣어 주세요.",
  "audio-capture": "마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인한 뒤 다시 눌러 주세요.",
  network: "음성 인식 서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.",
  "language-not-supported": "이 브라우저는 한국어 받아쓰기를 지원하지 않습니다. 크롬이나 엣지에서 열어 주세요.",
};

const UNSTABLE_MESSAGE =
  "받아쓰기가 자꾸 멈춥니다. 마이크 연결과 인터넷을 확인한 뒤 다시 눌러 주세요. 지금까지 받아쓴 글은 그대로 있습니다.";

export interface SpeechRecognitionState {
  /** 이 브라우저가 받아쓰기를 지원하는지 */
  supported: boolean;
  listening: boolean;
  /** 아직 확정되지 않은(말하는 중인) 글 */
  interim: string;
  /** 사용자에게 보여줄 문구 (다음 할 일 포함) */
  error: string | null;
  start: () => void;
  stop: () => void;
}

/** onFinal: 확정된 글 한 덩어리가 나올 때마다 부른다 */
export function useSpeechRecognition(onFinal: (text: string) => void): SpeechRecognitionState {
  const [supported] = useState(() => recognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<Recognition | null>(null);
  /** 사용자가 듣기를 원하는 동안 true. 저절로 멈췄을 때 다시 시작할지 정한다 */
  const wantRef = useRef(false);
  const restartTimesRef = useRef<number[]>([]);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const release = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // 이미 멈춘 경우
    }
    recognitionRef.current = null;
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        // stop은 지금까지 들은 말을 마저 확정한 뒤 onend를 부른다
        recognition.stop();
      } catch {
        release();
        setListening(false);
      }
    } else {
      setListening(false);
    }
    setInterim("");
  }, [release]);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    release();
    setError(null);
    setInterim("");
    restartTimesRef.current = [];
    wantRef.current = true;

    const recognition = new Constructor();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let pending = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) onFinalRef.current(text);
        else pending += text;
      }
      setInterim(pending);
    };

    recognition.onerror = (event) => {
      // 조용해서 멈춘 것(no-speech)과 우리가 끊은 것(aborted)은 오류로 보이지 않는다
      if (event.error === "no-speech" || event.error === "aborted") return;
      wantRef.current = false;
      setError(ERROR_MESSAGES[event.error] ?? "받아쓰기가 멈췄습니다. 다시 눌러 주세요. 지금까지 받아쓴 글은 그대로 있습니다.");
    };

    recognition.onend = () => {
      setInterim("");
      if (!wantRef.current) {
        setListening(false);
        return;
      }
      const now = Date.now();
      const recent = restartTimesRef.current.filter((time) => now - time < RESTART_WINDOW_MS);
      recent.push(now);
      restartTimesRef.current = recent;
      if (recent.length > MAX_RESTARTS_IN_WINDOW) {
        wantRef.current = false;
        setListening(false);
        setError(UNSTABLE_MESSAGE);
        return;
      }
      try {
        recognition.start();
      } catch {
        wantRef.current = false;
        setListening(false);
        setError(UNSTABLE_MESSAGE);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      wantRef.current = false;
      setError("받아쓰기를 시작하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
    }
  }, [release]);

  // 화면을 닫으면 듣기를 끝낸다
  useEffect(() => {
    return () => {
      wantRef.current = false;
      release();
    };
  }, [release]);

  return { supported, listening, interim, error, start, stop };
}
