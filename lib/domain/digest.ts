// 매일 아침 알림 메일 만들기 (순수 함수). 받는 사람마다 메일 한 통에 "내일 강의"와 "미입금 강사료"를 모은다.
// 보내는 일은 lib/server/dailyJob.ts가 한다. 테스트: tests/unit/digest.test.ts
//
// 받는 사람 규칙
// - 내일 강의: 진행 중 과정의 내일 회차 → 그 과정의 담당 강사
// - 미입금 강사료: 예정일 다음 날, 그 뒤 7일마다(shouldRemindOverdue) → 그 강사 본인 + 모든 관리자
// - 지금 팀원(members 문서가 있는 사람)이거나 첫 관리자에게만 보낸다. 팀에서 내보낸 사람에게는 가지 않는다.

import { BOOTSTRAP_ADMIN_EMAIL, isBootstrapAdmin } from "./roles";
import { addDays, formatDateKo, type DateString } from "./dates";
import { formatWon, shouldRemindOverdue } from "./fees";
import {
  courseLabel,
  coursePath,
  feeTitle,
  lecturesFor,
  lecturesOn,
  OVERDUE_FEES_PATH,
  overdueFeeItems,
  personLabel,
  sessionPlace,
  type LectureItem,
  type NoticeCourse,
  type NoticeFee,
  type NoticeMember,
  type NoticeSession,
  type OverdueFeeItem,
} from "./notices";

/** 운영 주소. APP_BASE_URL 환경 변수가 없거나 이상하면 이 주소로 링크를 만든다 */
export const DEFAULT_APP_URL = "https://edu-project-beta.vercel.app";

export const MAIL_SUBJECT_PREFIX = "[강의 준비 보드]";

export interface DigestInput {
  /** 오늘 한국 날짜 */
  today: DateString;
  /** 휴지통에 없는 과정 (진행 중 + 보관). 강의는 진행 중 과정만 본다 */
  courses: readonly NoticeCourse[];
  /** 과정 id → 내일 회차 (다른 날 회차가 섞여 있어도 내일 것만 쓴다) */
  sessionsByCourse: Readonly<Record<string, readonly NoticeSession[] | undefined>>;
  /** 입금 전 강사료 */
  fees: readonly NoticeFee[];
  members: readonly NoticeMember[];
  /** 메일 속 링크의 앞부분. 없으면 DEFAULT_APP_URL */
  appUrl?: string;
}

export interface DigestEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  lectureCount: number;
  feeCount: number;
}

/**
 * 링크 주소 정리: https 주소(개발용 localhost는 http도 허용)의 origin만 쓴다.
 * 비었거나 형식이 이상하면 DEFAULT_APP_URL.
 */
export function resolveAppUrl(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_APP_URL;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || (url.protocol === "http:" && local)) return url.origin;
  } catch {
    // 아래 기본값으로
  }
  return DEFAULT_APP_URL;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML 본문·속성에 넣을 글자. 과정 이름에 <script> 같은 글이 있어도 글자로만 보인다 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** 팀원 이메일(소문자) 모음 + 첫 관리자 */
function recipientSets(members: readonly NoticeMember[]) {
  const allowed = new Set<string>([BOOTSTRAP_ADMIN_EMAIL]);
  const admins = new Set<string>([BOOTSTRAP_ADMIN_EMAIL]);
  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    if (!email) continue;
    allowed.add(email);
    if (member.role === "admin" || isBootstrapAdmin(email)) admins.add(email);
  }
  return { allowed, admins };
}

export function digestSubject(lectureCount: number, feeCount: number): string {
  const parts: string[] = [];
  if (lectureCount > 0) parts.push(`내일 강의 ${lectureCount}건`);
  if (feeCount > 0) parts.push(`미입금 강사료 ${feeCount}건`);
  return `${MAIL_SUBJECT_PREFIX} ${parts.join(" · ")}`;
}

interface RecipientItems {
  to: string;
  lectures: LectureItem[];
  fees: OverdueFeeItem[];
}

interface MailContext {
  today: DateString;
  tomorrow: DateString;
  appUrl: string;
  members: readonly NoticeMember[];
}

function lectureLines(item: LectureItem) {
  const time = item.session.startTime ?? "시간 미정";
  return {
    title: `${time} ${courseLabel(item.course)}`,
    place: sessionPlace(item.session),
    href: coursePath(item.course.id),
  };
}

function feeLines(item: OverdueFeeItem, recipient: string, members: readonly NoticeMember[]) {
  const own = item.fee.instructorEmail.trim().toLowerCase() === recipient;
  const who = own ? "내 강사료" : `${personLabel(item.fee.instructorEmail, members)} 강사`;
  return {
    title: `${feeTitle(item)} ${formatWon(item.fee.amount)}`,
    detail: `${who} · 입금 예정일 ${formatDateKo(item.fee.dueDate)} · ${item.days}일 지남`,
  };
}

const FOOTER_TEXT =
  "이 메일은 강의 준비 보드가 매일 오전 9시쯤 자동으로 보냅니다. 알릴 내용이 없는 날에는 보내지 않습니다.";
const FEE_HINT = "입금을 확인했다면 강사료 화면에서 입금일을 적어 주세요. 입금일을 적으면 이 알림이 멈춥니다.";

function buildText(items: RecipientItems, context: MailContext): string {
  const lines: string[] = [];
  lines.push(`${personLabel(items.to, context.members)}님, 안녕하세요.`);
  lines.push(`강의 준비 보드에서 오늘(${formatDateKo(context.today)}) 확인할 내용을 알려 드립니다.`);

  if (items.lectures.length > 0) {
    lines.push("", `■ 내일 강의 · ${formatDateKo(context.tomorrow)}`);
    for (const item of items.lectures) {
      const line = lectureLines(item);
      lines.push(`- ${line.title}`);
      if (line.place) lines.push(`  ${line.place}`);
      lines.push(`  ${context.appUrl}${line.href}`);
    }
  }

  if (items.fees.length > 0) {
    lines.push("", "■ 미입금 강사료");
    for (const item of items.fees) {
      const line = feeLines(item, items.to, context.members);
      lines.push(`- ${line.title}`, `  ${line.detail}`);
    }
    lines.push(`  강사료 화면: ${context.appUrl}${OVERDUE_FEES_PATH}`, "", FEE_HINT);
  }

  lines.push("", `강의 준비 보드 열기: ${context.appUrl}/`, "", FOOTER_TEXT);
  return lines.join("\n");
}

// 메일 프로그램은 <style>을 지우는 경우가 많아 모든 모양을 글자 옆(inline style)에 둔다. 색은 design.md 토큰.
const STYLE = {
  body: "margin:0;padding:0;background:#f8fafc;",
  wrap:
    "max-width:560px;margin:0 auto;padding:24px 16px;font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;" +
    "color:#0f172a;font-size:14px;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;",
  eyebrow: "margin:0 0 4px;font-size:13px;color:#64748b;",
  heading: "margin:0 0 16px;font-size:20px;font-weight:700;color:#1e2a5a;",
  card: "background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0;",
  cardTitle: "margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;",
  list: "margin:0;padding:0 0 0 18px;",
  item: "margin:0 0 10px;",
  muted: "color:#64748b;font-size:13px;",
  danger: "color:#b91c1c;font-size:13px;",
  link: "color:#1e2a5a;font-weight:600;word-break:break-all;",
  button:
    "display:inline-block;background:#1e2a5a;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;",
  footer: "margin:24px 0 0;font-size:13px;color:#64748b;",
} as const;

function buildHtml(items: RecipientItems, subject: string, context: MailContext): string {
  const parts: string[] = [];
  const name = escapeHtml(personLabel(items.to, context.members));

  if (items.lectures.length > 0) {
    const rows = items.lectures
      .map((item) => {
        const line = lectureLines(item);
        const place = line.place ? `<br><span style="${STYLE.muted}">${escapeHtml(line.place)}</span>` : "";
        const href = escapeHtml(`${context.appUrl}${line.href}`);
        return (
          `<li style="${STYLE.item}"><strong>${escapeHtml(line.title)}</strong>${place}` +
          `<br><a href="${href}" style="${STYLE.link}">과정 보드 열기</a></li>`
        );
      })
      .join("");
    parts.push(
      `<div style="${STYLE.card}"><h2 style="${STYLE.cardTitle}">내일 강의 · ${escapeHtml(formatDateKo(context.tomorrow))}</h2>` +
        `<ul style="${STYLE.list}">${rows}</ul></div>`,
    );
  }

  if (items.fees.length > 0) {
    const rows = items.fees
      .map((item) => {
        const line = feeLines(item, items.to, context.members);
        return (
          `<li style="${STYLE.item}"><strong>${escapeHtml(line.title)}</strong>` +
          `<br><span style="${STYLE.danger}">${escapeHtml(line.detail)}</span></li>`
        );
      })
      .join("");
    const feesHref = escapeHtml(`${context.appUrl}${OVERDUE_FEES_PATH}`);
    parts.push(
      `<div style="${STYLE.card}"><h2 style="${STYLE.cardTitle}">미입금 강사료</h2>` +
        `<ul style="${STYLE.list}">${rows}</ul>` +
        `<p style="margin:8px 0 0;${STYLE.muted}">${escapeHtml(FEE_HINT)}</p>` +
        `<p style="margin:8px 0 0;"><a href="${feesHref}" style="${STYLE.link}">강사료 화면 열기</a></p></div>`,
    );
  }

  const homeHref = escapeHtml(`${context.appUrl}/`);
  return [
    `<!doctype html><html lang="ko"><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="${STYLE.body}"><div style="${STYLE.wrap}">`,
    `<p style="${STYLE.eyebrow}">강의 준비 보드 · ${escapeHtml(formatDateKo(context.today))}</p>`,
    `<h1 style="${STYLE.heading}">오늘 확인할 알림</h1>`,
    `<p style="margin:0;">${name}님, 안녕하세요. 오늘 확인할 내용을 알려 드립니다.</p>`,
    ...parts,
    `<p style="margin:16px 0 0;"><a href="${homeHref}" style="${STYLE.button}">강의 준비 보드 열기</a></p>`,
    `<p style="${STYLE.footer}">${escapeHtml(FOOTER_TEXT)}</p>`,
    `</div></body></html>`,
  ].join("");
}

/**
 * 받는 사람마다 메일 한 통. 알릴 것이 없는 사람은 빠진다. 받는 사람 이메일 순.
 */
export function buildDailyDigests(input: DigestInput): DigestEmail[] {
  const tomorrow = addDays(input.today, 1);
  const appUrl = resolveAppUrl(input.appUrl);
  const { allowed, admins } = recipientSets(input.members);

  const lectures = lecturesOn(tomorrow, input.courses, input.sessionsByCourse);
  const remindFees = overdueFeeItems(input.fees, input.courses, input.today).filter((item) =>
    shouldRemindOverdue(item.fee, input.today),
  );

  const byRecipient = new Map<string, RecipientItems>();
  const entry = (email: string): RecipientItems | null => {
    const to = email.trim().toLowerCase();
    if (!allowed.has(to)) return null;
    let items = byRecipient.get(to);
    if (!items) {
      items = { to, lectures: [], fees: [] };
      byRecipient.set(to, items);
    }
    return items;
  };

  for (const email of allowed) {
    const mine = lecturesFor(email, lectures);
    if (mine.length > 0) entry(email)?.lectures.push(...mine);
  }

  for (const item of remindFees) {
    const recipients = new Set([item.fee.instructorEmail.trim().toLowerCase(), ...admins]);
    for (const email of recipients) entry(email)?.fees.push(item);
  }

  const context: MailContext = { today: input.today, tomorrow, appUrl, members: input.members };
  return [...byRecipient.values()]
    .sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0))
    .map((items) => {
      const subject = digestSubject(items.lectures.length, items.fees.length);
      return {
        to: items.to,
        subject,
        text: buildText(items, context),
        html: buildHtml(items, subject, context),
        lectureCount: items.lectures.length,
        feeCount: items.fees.length,
      };
    });
}

export interface TestEmailInput {
  to: string;
  /** 받는 관리자 이름 (없으면 이메일) */
  name: string;
  today: DateString;
  appUrl?: string;
}

/** 관리자 화면의 "나에게 테스트 메일 보내기" 메일 */
export function buildTestEmail(input: TestEmailInput): Omit<DigestEmail, "lectureCount" | "feeCount"> {
  const appUrl = resolveAppUrl(input.appUrl);
  const subject = `${MAIL_SUBJECT_PREFIX} 테스트 메일`;
  const intro = `${input.name}님, 알림 메일 설정이 잘 되어 있습니다.`;
  const body =
    "매일 오전 9시쯤 내일 강의가 있는 담당 강사와, 입금 예정일이 지난 강사료가 있는 강사·관리자에게 알림 메일이 갑니다.";
  const text = [intro, "", body, "", `강의 준비 보드 열기: ${appUrl}/`, "", `보낸 날: ${formatDateKo(input.today, { withYear: true })}`].join(
    "\n",
  );
  const html = [
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="${STYLE.body}"><div style="${STYLE.wrap}">`,
    `<h1 style="${STYLE.heading}">테스트 메일</h1>`,
    `<p style="margin:0 0 8px;">${escapeHtml(intro)}</p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(body)}</p>`,
    `<p style="margin:0;"><a href="${escapeHtml(`${appUrl}/`)}" style="${STYLE.button}">강의 준비 보드 열기</a></p>`,
    `<p style="${STYLE.footer}">보낸 날: ${escapeHtml(formatDateKo(input.today, { withYear: true }))}</p>`,
    `</div></body></html>`,
  ].join("");
  return { to: input.to, subject, text, html };
}
