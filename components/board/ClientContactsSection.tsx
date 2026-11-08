"use client";

// 과정 보드의 "고객사 담당자": 과정의 고객사 이름(course.client)과 같은 주소록 고객사의 담당자 연락처.
// 이름은 느슨하게 맞춘다 (띄어쓰기·대소문자·"(주)" 차이 무시, lib/domain/clients.ts).
// - 고객사 이름이 비었으면: 과정 정보 수정에서 넣으라고 안내
// - 주소록에 없으면: "주소록에 추가" → /clients?new=이름
// - 있으면: 담당자 목록(전화·메일 바로 걸기) + "주소록에서 보기·고치기" → /clients?client=고객사id
// 주소록 구독은 이 구역이 직접 연다 (useCourseBoardData와 따로).

import { ContactDetails } from "@/components/clients/ContactDetails";
import { clientHref, newClientHref } from "@/components/clients/clientLinks";
import { useClientContacts, useClients } from "@/components/clients/useClientDirectory";
import { Alert } from "@/components/ui/Alert";
import { tileListClass } from "@/components/ui/Bento";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { PlusIcon } from "@/components/ui/icons";
import type { ClientContact } from "@/lib/data/types";
import { findClientByName } from "@/lib/domain/clients";
import type { LiveValue } from "./useLiveSubscription";

interface ClientContactsSectionProps {
  /** 과정의 고객사 이름 (course.client) */
  clientName: string;
}

export function ClientContactsSection({ clientName }: ClientContactsSectionProps) {
  const name = clientName.trim();
  const clients = useClients(name.length > 0);
  const client = clients.loaded ? findClientByName(clients.value, name) : null;
  const contacts = useClientContacts(client?.id ?? null);

  const description = !client
    ? "고객사 주소록에 넣어 둔 담당자 연락처가 여기에 보입니다."
    : client.name === name
      ? "주소록에 넣어 둔 담당자 연락처입니다. 누르면 바로 전화하거나 메일을 쓸 수 있습니다."
      : `주소록의 ‘${client.name}’ 담당자 연락처입니다. 누르면 바로 전화하거나 메일을 쓸 수 있습니다.`;

  return (
    <Section
      tile
      title="고객사 담당자"
      meta={client && contacts.loaded ? `${contacts.value.length}명` : undefined}
      description={description}
      action={
        client ? (
          <ButtonLink href={clientHref(client.id)} variant="outline" size="sm">
            주소록에서 보기·고치기
          </ButtonLink>
        ) : null
      }
    >
      {name.length === 0 ? (
        <EmptyState
          size="sm"
          title="고객사 이름이 비어 있습니다"
          description="위의 ‘과정 정보 수정’에서 고객사를 적으면 주소록의 담당자 연락처가 여기에 보입니다."
        />
      ) : (
        <>
          {/* 끊기기 전에 받은 주소록이 있으면 그대로 보여 주고, 최신이 아닐 수 있다고 알린다 */}
          {clients.error ? (
            <Alert
              tone="error"
              title="고객사 주소록을 불러오지 못했습니다"
              action={
                <Button variant="outline" size="sm" onClick={clients.retry}>
                  다시 시도
                </Button>
              }
            >
              {clients.error}
            </Alert>
          ) : null}

          {!clients.loaded ? (
            clients.error ? null : <InlineLoading label="고객사 주소록을 불러오는 중입니다…" />
          ) : !client ? (
            <EmptyState
              size="sm"
              title={`주소록에 ‘${name}’이(가) 없습니다`}
              description="주소록에 추가하고 담당자 연락처를 넣어 두면 이 보드에서 바로 전화하거나 메일을 쓸 수 있습니다."
              action={
                <ButtonLink href={newClientHref(name)} variant="outline" size="sm">
                  <PlusIcon />
                  주소록에 추가
                </ButtonLink>
              }
            />
          ) : (
            <ContactsBody clientName={client.name} contacts={contacts} />
          )}
        </>
      )}
    </Section>
  );
}

interface ContactsBodyProps {
  clientName: string;
  contacts: LiveValue<ClientContact[]>;
}

function ContactsBody({ clientName, contacts }: ContactsBodyProps) {
  return (
    <>
      {contacts.error ? (
        <Alert
          tone="error"
          title="담당자 연락처를 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={contacts.retry}>
              다시 시도
            </Button>
          }
        >
          {contacts.error}
        </Alert>
      ) : null}

      {!contacts.loaded && !contacts.error ? <InlineLoading label="담당자 연락처를 불러오는 중입니다…" /> : null}

      {contacts.loaded && contacts.value.length === 0 ? (
        <EmptyState
          size="sm"
          title={`‘${clientName}’에 넣어 둔 담당자가 없습니다`}
          description="‘주소록에서 보기·고치기’를 눌러 담당자를 추가하면 여기에 보입니다."
        />
      ) : null}

      {contacts.value.length > 0 ? (
        <ul className={tileListClass}>
          {contacts.value.map((contact) => (
            <li key={contact.id}>
              <Card padding="sm" flat className="h-full">
                <ContactDetails contact={contact} />
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
