import "server-only";

// Gmail로 메일 보내기 (nodemailer). 보내는 계정·앱 비밀번호는 환경 변수 GMAIL_USER, GMAIL_APP_PASSWORD에서만 읽는다.
// Gmail SMTP 서버(smtp.gmail.com:465, 암호화 연결)에 로그인해서 보낸다. 무료 Gmail은 하루 약 500통까지.

import nodemailer from "nodemailer";
import { withTimeout } from "@/lib/domain/async";
import { ServerSetupError } from "./errors";

/** 보내는 사람 이름 (받은편지함에 보이는 이름) */
export const MAIL_FROM_NAME = "강의 준비 보드";

/** 메일 한 통 보내기 시간 제한. 연결·인사·소켓 시간 제한과 별도로 전체를 한 번 더 묶는다 */
const SEND_TIMEOUT_MS = 30_000;

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
  /** 열어 둔 연결을 닫는다. 작업이 끝나면 꼭 부른다 */
  close(): void;
}

function readGmailSettings() {
  const user = (process.env.GMAIL_USER ?? "").trim().toLowerCase();
  // 구글은 앱 비밀번호를 "abcd efgh ijkl mnop"처럼 띄어 보여 준다. 띄어쓰기는 빼고 쓴다
  const pass = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");
  if (!user) {
    throw new ServerSetupError(
      "gmail-user-missing",
      "GMAIL_USER 환경 변수가 비어 있습니다. 메일을 보낼 Gmail 주소를 Vercel 환경 변수에 넣고 다시 배포해 주세요.",
    );
  }
  if (!pass) {
    throw new ServerSetupError(
      "gmail-password-missing",
      "GMAIL_APP_PASSWORD 환경 변수가 비어 있습니다. 구글 계정에서 만든 앱 비밀번호 16자리를 Vercel 환경 변수에 넣고 다시 배포해 주세요.",
    );
  }
  return { user, pass };
}

/**
 * Gmail 보내기 도구. 연결을 몇 개 열어 두고 여러 통을 이어서 보낸다(pool).
 * 환경 변수가 없으면 ServerSetupError.
 */
export function createMailer(): Mailer {
  const { user, pass } = readGmailSettings();
  const transport = nodemailer.createTransport(
    {
      pool: true,
      maxConnections: 2,
      service: "Gmail",
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      dnsTimeout: 10_000,
    },
    { from: { name: MAIL_FROM_NAME, address: user } },
  );

  return {
    async send(mail) {
      await withTimeout(
        transport.sendMail({ to: mail.to, subject: mail.subject, text: mail.text, html: mail.html }),
        SEND_TIMEOUT_MS,
      );
    },
    close() {
      transport.close();
    },
  };
}
