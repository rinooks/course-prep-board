// 담당자 한 사람의 연락처: 이름, 부서·직책, 전화(누르면 전화 걸기), 메일(누르면 메일 쓰기), 메모.
// 주소록 화면과 과정 보드의 "고객사 담당자"가 같이 쓴다. 버튼은 쓰는 쪽이 붙인다.

import type { ReactNode } from "react";
import { cn, focusRing } from "@/components/ui/cn";
import type { ClientContact } from "@/lib/data/types";
import { mailtoHref, telHref } from "@/lib/domain/clients";

const LINK_CLASS = cn(
  "inline-flex min-h-11 max-w-full items-center rounded-button font-semibold text-primary hover:underline",
  focusRing,
);

interface ContactDetailsProps {
  contact: ClientContact;
}

export function ContactDetails({ contact }: ContactDetailsProps) {
  const tel = contact.phone ? telHref(contact.phone) : null;
  const mail = contact.email ? mailtoHref(contact.email) : null;
  const hasContactInfo = contact.phone.length > 0 || contact.email.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="font-semibold text-ink">{contact.name}</p>
      {contact.role ? <p className="text-sm text-muted">{contact.role}</p> : null}

      {hasContactInfo ? (
        <dl className="flex flex-col text-sm">
          {contact.phone ? (
            <ContactLine label="전화">
              {tel ? (
                <a href={tel} className={LINK_CLASS}>
                  <span className="break-anywhere">{contact.phone}</span>
                  <span className="sr-only"> ({contact.name}에게 전화 걸기)</span>
                </a>
              ) : (
                <span className="break-anywhere text-ink">{contact.phone}</span>
              )}
            </ContactLine>
          ) : null}
          {mail ? (
            <ContactLine label="메일">
              <a href={mail} className={LINK_CLASS}>
                <span className="break-anywhere">{contact.email}</span>
                <span className="sr-only"> ({contact.name}에게 메일 쓰기)</span>
              </a>
            </ContactLine>
          ) : null}
        </dl>
      ) : (
        <p className="text-sm text-muted">전화번호·메일을 아직 넣지 않았습니다.</p>
      )}

      {contact.memo ? <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{contact.memo}</p> : null}
    </div>
  );
}

function ContactLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-8 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
