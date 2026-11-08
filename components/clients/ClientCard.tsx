"use client";

// 주소록의 고객사 카드 하나: 이름·메모, 담당자 연락처(추가·고치기·지우기), 이 고객사 이름으로 적힌 과정.
// 버튼을 누르면 창을 여는 일은 부른 쪽(ClientsScreen)이 맡는다.

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { RowLink } from "@/components/ui/Row";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { cn } from "@/components/ui/cn";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import type { Client, ClientContact, Course } from "@/lib/data/types";
import { clientElementId } from "./clientLinks";
import { ContactDetails } from "./ContactDetails";

export type LoadState = "loading" | "error" | "ready";

interface ClientCardProps {
  client: Client;
  /** 화면에 보일 담당자 (검색 중이면 맞는 사람만) */
  contacts: readonly ClientContact[];
  /** 이 고객사의 전체 담당자 수 */
  totalContacts: number;
  /** true면 검색과 맞는 담당자만 보이는 중 */
  filtered: boolean;
  contactsState: LoadState;
  /** 이 고객사 이름으로 적힌 과정 (진행 중 + 보관) */
  courses: readonly Course[];
  coursesState: LoadState;
  /** 주소로 찾아온 고객사면 true: 테두리로 표시한다 */
  highlighted: boolean;
  isAdmin: boolean;
  onEditClient: () => void;
  onDeleteClient: () => void;
  onAddContact: () => void;
  onEditContact: (contact: ClientContact) => void;
  onDeleteContact: (contact: ClientContact) => void;
}

export function ClientCard({
  client,
  contacts,
  totalContacts,
  filtered,
  contactsState,
  courses,
  coursesState,
  highlighted,
  isAdmin,
  onEditClient,
  onDeleteClient,
  onAddContact,
  onEditContact,
  onDeleteContact,
}: ClientCardProps) {
  const contactsMeta =
    contactsState !== "ready" ? undefined : filtered ? `${contacts.length}/${totalContacts}명` : `${totalContacts}명`;

  return (
    <Card
      id={clientElementId(client.id)}
      tabIndex={-1}
      className={cn("flex h-full scroll-mt-20 flex-col gap-5 focus:outline-none", highlighted && "ring-2 ring-primary/40")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-bold tracking-tight text-balance text-ink">{client.name}</h2>
          {client.memo ? (
            <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-muted">{client.memo}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onEditClient}>
            <PencilIcon />
            고객사 고치기
            <span className="sr-only">({client.name})</span>
          </Button>
          {/* 고객사 지우기는 관리자만 (보안 규칙도 같다) */}
          {isAdmin ? (
            <Button variant="dangerGhost" size="sm" onClick={onDeleteClient}>
              <TrashIcon />
              고객사 지우기
              <span className="sr-only">({client.name})</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* 고객사 타일이 두 칸으로 놓이는 넓은 화면에서는 폭이 좁으므로 담당자와 과정을 위아래로 둔다 */}
      <div className="grid gap-6 lg:max-xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Section
          as="h3"
          title="담당자"
          meta={contactsMeta}
          action={
            <Button variant="outline" size="sm" onClick={onAddContact}>
              <PlusIcon />
              담당자 추가
              <span className="sr-only">({client.name})</span>
            </Button>
          }
        >
          <ContactList
            client={client}
            contacts={contacts}
            totalContacts={totalContacts}
            filtered={filtered}
            state={contactsState}
            onEditContact={onEditContact}
            onDeleteContact={onDeleteContact}
          />
        </Section>

        <Section
          as="h3"
          title="과정"
          meta={coursesState === "ready" ? `${courses.length}개` : undefined}
        >
          <CourseLinks clientName={client.name} courses={courses} state={coursesState} />
        </Section>
      </div>
    </Card>
  );
}

interface ContactListProps {
  client: Client;
  contacts: readonly ClientContact[];
  totalContacts: number;
  filtered: boolean;
  state: LoadState;
  onEditContact: (contact: ClientContact) => void;
  onDeleteContact: (contact: ClientContact) => void;
}

function ContactList({
  client,
  contacts,
  totalContacts,
  filtered,
  state,
  onEditContact,
  onDeleteContact,
}: ContactListProps) {
  if (state === "loading") return <InlineLoading label="담당자를 불러오는 중입니다…" />;
  if (state === "error") {
    return <p className="text-sm text-muted">담당자를 불러오지 못했습니다. 위의 &lsquo;다시 시도&rsquo;를 눌러 주세요.</p>;
  }
  if (totalContacts === 0) {
    return (
      <p className="text-sm text-muted">
        아직 담당자가 없습니다. &lsquo;담당자 추가&rsquo;로 연락처를 넣으면 이 고객사의 과정 보드에도 보입니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filtered ? (
        <p className="text-sm text-muted">
          검색과 맞는 담당자만 보입니다 (전체 {totalContacts}명).
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {contacts.map((contact) => (
          <li key={contact.id}>
            <Card padding="sm" flat className="flex h-full flex-col gap-2">
              <ContactDetails contact={contact} />
              <div className="mt-auto flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => onEditContact(contact)}>
                  <PencilIcon />
                  고치기
                  <span className="sr-only">({client.name} 담당자 {contact.name})</span>
                </Button>
                <Button variant="dangerGhost" size="sm" onClick={() => onDeleteContact(contact)}>
                  <TrashIcon />
                  지우기
                  <span className="sr-only">({client.name} 담당자 {contact.name})</span>
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CourseLinksProps {
  clientName: string;
  courses: readonly Course[];
  state: LoadState;
}

function CourseLinks({ clientName, courses, state }: CourseLinksProps) {
  if (state === "loading" && courses.length === 0) return <InlineLoading label="과정을 불러오는 중입니다…" />;
  if (state === "error" && courses.length === 0) {
    return <p className="text-sm text-muted">과정 목록을 불러오지 못했습니다. 위의 &lsquo;다시 시도&rsquo;를 눌러 주세요.</p>;
  }
  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted">
        이 이름으로 적힌 과정이 없습니다. 과정의 고객사 칸에 &lsquo;{clientName}&rsquo;을(를) 적으면 연결됩니다.
      </p>
    );
  }

  return (
    <ul className="-mx-3 flex flex-col">
      {courses.map((course) => (
        <li key={course.id}>
          <RowLink href={`/courses/${course.id}`}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{course.title}</span>
              {course.status === "archived" ? <Badge>보관됨</Badge> : null}
            </span>
          </RowLink>
        </li>
      ))}
    </ul>
  );
}
