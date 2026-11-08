"use client";

// 고객사 주소록 (/clients): 고객사와 담당자 연락처를 팀이 함께 관리한다.
// - 과정은 고객사를 이름(course.client)으로 가리킨다. 이름이 같으면(띄어쓰기·"(주)" 차이 무시) 과정 보드에 담당자가 보인다.
// - 주소의 ?new=이름 → "고객사 추가" 창을 그 이름으로 채워 연다 (과정 보드의 "주소록에 추가").
// - 주소의 ?client=고객사id → 그 고객사 카드로 옮겨 가 테두리로 표시한다 (과정 보드의 "주소록에서 보기·고치기").
// - 다른 화면에 갔다 돌아오면 검색어와 열린 창은 비운다 (Next.js가 떠난 화면을 그대로 보존하기 때문).
// useSearchParams를 쓰므로 app/clients/page.tsx에서 Suspense로 감싼다.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCourseList } from "@/components/home/useCourseList";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { PlusIcon } from "@/components/ui/icons";
import { jumpToElement } from "@/components/ui/jumpTo";
import { deleteClient, deleteContact } from "@/lib/data/clients";
import type { Client, ClientContact, Course } from "@/lib/data/types";
import { coursesOfClient } from "@/lib/domain/clients";
import { AppError } from "@/lib/domain/errors";
import { LIMITS } from "@/lib/domain/validation";
import { ClientCard, type LoadState } from "./ClientCard";
import { ClientFormModal } from "./ClientFormModal";
import { ContactFormModal } from "./ContactFormModal";
import { CLIENT_PARAM, CLIENTS_PATH, clientElementId, clientHref, NEW_CLIENT_PARAM } from "./clientLinks";
import { groupContactsByClient, isBlankQuery, searchClients } from "./clientSearch";
import { useAllContacts, useClients } from "./useClientDirectory";

/** 직접 연 고객사 창 ("고객사 추가" 버튼, "고객사 고치기") */
type ClientFormState = { mode: "create" } | { mode: "edit"; client: Client } | null;

/** 화면에 띄울 고객사 창: 직접 연 창, 또는 주소의 ?new=로 연 창 */
type ShownClientForm =
  | { key: string; client: null; initialName: string }
  | { key: string; client: Client; initialName: string };

interface ContactFormState {
  client: Client;
  /** 고칠 담당자. null이면 추가 */
  contact: ClientContact | null;
}

interface DeletingContact {
  client: Client;
  contact: ClientContact;
}

const NO_COURSES: Course[] = [];

export function ClientsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const searchId = useId();

  const clients = useClients();
  const contacts = useAllContacts();
  const active = useCourseList("active");
  const archived = useCourseList("archived");

  const [query, setQuery] = useState("");
  const [clientForm, setClientForm] = useState<ClientFormState>(null);
  const [contactForm, setContactForm] = useState<ContactFormState | null>(null);
  const [deletingContact, setDeletingContact] = useState<DeletingContact | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  /** 이미 옮겨 간 ?client= 값 (같은 값으로 다시 옮겨 가지 않게) */
  const jumpedToRef = useRef<string | null>(null);

  const newParam = searchParams.get(NEW_CLIENT_PARAM);
  const targetClientId = searchParams.get(CLIENT_PARAM) || null;

  const contactsByClient = useMemo(() => groupContactsByClient(contacts.value), [contacts.value]);
  const allCourses = useMemo(
    () => [...(active.courses ?? NO_COURSES), ...(archived.courses ?? NO_COURSES)],
    [active.courses, archived.courses],
  );
  const results = useMemo(
    () => searchClients(clients.value, contactsByClient, query),
    [clients.value, contactsByClient, query],
  );

  const targetShown = targetClientId !== null && results.some((result) => result.client.id === targetClientId);
  const targetMissing =
    targetClientId !== null && clients.loaded && !clients.value.some((client) => client.id === targetClientId);

  // 다른 화면으로 갔다 오면 검색어·창을 비운다. 주소로 찾아온 고객사에는 다시 옮겨 간다.
  useLayoutEffect(() => {
    return () => {
      jumpedToRef.current = null;
      setQuery("");
      setClientForm(null);
      setContactForm(null);
      setDeletingContact(null);
      setDeletingClient(null);
    };
  }, []);

  // ?client=로 찾아온 고객사 카드로 옮겨 간다 (카드가 그려진 뒤에)
  useEffect(() => {
    if (targetClientId === null || !targetShown) return;
    if (jumpedToRef.current === targetClientId) return;
    jumpedToRef.current = targetClientId;
    jumpToElement(clientElementId(targetClientId));
  }, [targetClientId, targetShown]);

  // 같은 이름 검사에 고객사 목록이 필요하므로, 목록을 받은 뒤에 창을 연다
  const linkedNewName = newParam !== null && clients.loaded ? newParam.trim().slice(0, LIMITS.clientName) : null;
  const shownClientForm: ShownClientForm | null =
    clientForm?.mode === "edit"
      ? { key: `edit:${clientForm.client.id}`, client: clientForm.client, initialName: "" }
      : clientForm?.mode === "create"
        ? { key: "new", client: null, initialName: "" }
        : linkedNewName !== null
          ? { key: `new:${linkedNewName}`, client: null, initialName: linkedNewName }
          : null;

  function closeClientForm() {
    setClientForm(null);
    // 주소의 ?new=를 지워야 창이 다시 열리지 않는다
    if (newParam !== null) router.replace(CLIENTS_PATH, { scroll: false });
  }

  function handleClientSaved(clientId: string, created: boolean) {
    setClientForm(null);
    if (created) {
      // 새 고객사가 검색에 가려지지 않게 검색어를 비우고, 그 카드로 옮겨 간다
      setQuery("");
      toast.success("고객사를 추가했습니다. 이어서 담당자를 추가해 주세요.");
      router.replace(clientHref(clientId), { scroll: false });
    } else {
      toast.success("고객사 정보를 고쳤습니다.");
    }
  }

  async function confirmDeleteClient() {
    if (!deletingClient) return;
    // 담당자 목록이 없으면 고객사만 지워지고 담당자가 남는다
    if (!contacts.loaded || contacts.error) {
      throw new AppError(
        "contacts-not-loaded",
        "담당자 목록을 불러오지 못해 지우지 않았습니다. 화면 위의 '다시 시도'를 누른 뒤 다시 지워 주세요.",
      );
    }
    const target = deletingClient;
    await deleteClient(target.id, contactsByClient.get(target.id) ?? []);
    toast.success(`${target.name} 고객사를 지웠습니다.`);
    if (targetClientId === target.id) router.replace(CLIENTS_PATH, { scroll: false });
  }

  async function confirmDeleteContact() {
    if (!deletingContact) return;
    const { contact } = deletingContact;
    await deleteContact(contact.id);
    toast.success(`${contact.name} 담당자를 지웠습니다.`);
  }

  const contactsState: LoadState = contacts.loaded ? "ready" : contacts.error ? "error" : "loading";
  const coursesError = active.error ?? archived.error;
  const coursesState: LoadState =
    active.courses !== null && archived.courses !== null ? "ready" : coursesError ? "error" : "loading";
  const searching = !isBlankQuery(query);
  const deletingClientContactCount = deletingClient ? (contactsByClient.get(deletingClient.id)?.length ?? 0) : 0;

  return (
    <>
      <PageHeader
        eyebrow="주소록"
        title="고객사"
        description="고객사와 담당자 연락처를 팀이 함께 관리합니다. 과정의 고객사 칸에 같은 이름을 적으면 그 과정 보드에도 담당자 연락처가 보입니다."
        actions={
          <Button
            variant="inverse"
            size="sm"
            disabled={!clients.loaded}
            onClick={() => setClientForm({ mode: "create" })}
          >
            <PlusIcon />
            고객사 추가
          </Button>
        }
      />

      <PageBody>
        {clients.error ? (
          <Alert
            tone="error"
            title="주소록을 불러오지 못했습니다"
            action={
              <Button variant="outline" size="sm" onClick={clients.retry}>
                다시 시도
              </Button>
            }
          >
            {clients.error}
          </Alert>
        ) : null}

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

        {coursesError ? (
          <Alert
            tone="warning"
            title="과정 목록을 불러오지 못했습니다"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  active.retry();
                  archived.retry();
                }}
              >
                다시 시도
              </Button>
            }
          >
            고객사별 과정이 비어 보일 수 있습니다. {coursesError}
          </Alert>
        ) : null}

        {targetMissing ? (
          <Alert tone="info" title="찾는 고객사가 주소록에 없습니다">
            다른 팀원이 지웠을 수 있습니다. 아래 목록에서 찾거나 새로 추가해 주세요.
          </Alert>
        ) : null}

        {!clients.loaded ? (
          clients.error ? null : (
            <LoadingBlock label="주소록을 불러오는 중입니다…" />
          )
        ) : clients.value.length === 0 ? (
          <EmptyState
            title="주소록에 고객사가 없습니다"
            description="고객사를 추가하고 담당자 연락처를 넣어 두세요. 과정의 고객사 칸에 같은 이름을 적으면, 그 과정 보드에서 바로 담당자에게 전화하거나 메일을 쓸 수 있습니다."
            action={
              <Button onClick={() => setClientForm({ mode: "create" })}>
                <PlusIcon />
                고객사 추가
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-2">
              <Field id={searchId} label="고객사·담당자 찾기" className="md:max-w-md">
                <Input
                  id={searchId}
                  type="search"
                  value={query}
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="고객사·담당자 이름, 부서, 전화번호, 이메일"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Field>
              <p className="text-sm text-muted" aria-live="polite">
                {searching
                  ? `찾은 고객사 ${results.length}곳`
                  : `고객사 ${clients.value.length}곳${contacts.loaded ? ` · 담당자 ${contacts.value.length}명` : ""}`}
              </p>
            </Card>

            {results.length === 0 ? (
              <EmptyState
                title="찾는 고객사·담당자가 없습니다"
                description="이름 일부나 전화번호 뒷자리로도 찾을 수 있습니다. 철자를 확인하거나 검색어를 지워 주세요."
                action={
                  <Button variant="outline" onClick={() => setQuery("")}>
                    검색어 지우기
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-4 xl:grid-cols-2">
                {results.map((result) => {
                  const client = result.client;
                  return (
                    <li key={client.id} className="min-w-0 xl:odd:last:col-span-2">
                      <ClientCard
                        client={client}
                        contacts={result.contacts}
                        totalContacts={result.totalContacts}
                        filtered={result.filtered}
                        contactsState={contactsState}
                        courses={coursesOfClient(allCourses, client)}
                        coursesState={coursesState}
                        highlighted={client.id === targetClientId}
                        isAdmin={isAdmin}
                        onEditClient={() => setClientForm({ mode: "edit", client })}
                        onDeleteClient={() => setDeletingClient(client)}
                        onAddContact={() => setContactForm({ client, contact: null })}
                        onEditContact={(contact) => setContactForm({ client, contact })}
                        onDeleteContact={(contact) => setDeletingContact({ client, contact })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </PageBody>

      {shownClientForm ? (
        <ClientFormModal
          key={shownClientForm.key}
          client={shownClientForm.client}
          initialName={shownClientForm.initialName}
          clients={clients.value}
          linkedCourseCount={shownClientForm.client ? coursesOfClient(allCourses, shownClientForm.client).length : 0}
          onClose={closeClientForm}
          onSaved={(clientId) => handleClientSaved(clientId, shownClientForm.client === null)}
        />
      ) : null}

      {contactForm ? (
        <ContactFormModal
          key={contactForm.contact ? `edit:${contactForm.contact.id}` : `new:${contactForm.client.id}`}
          client={contactForm.client}
          contact={contactForm.contact}
          onClose={() => setContactForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deletingContact !== null}
        onClose={() => setDeletingContact(null)}
        onConfirm={confirmDeleteContact}
        title="담당자를 지울까요?"
        description={
          deletingContact
            ? `${deletingContact.client.name} ${deletingContact.contact.name} 담당자의 연락처가 바로 지워지고 되살릴 수 없습니다. 개인정보라 휴지통에 남기지 않습니다.`
            : undefined
        }
        confirmLabel="지우기"
        tone="danger"
      />

      <ConfirmDialog
        open={deletingClient !== null}
        onClose={() => setDeletingClient(null)}
        onConfirm={confirmDeleteClient}
        title="고객사를 지울까요?"
        description={
          deletingClient
            ? `‘${deletingClient.name}’ 고객사${
                deletingClientContactCount > 0 ? `와 담당자 ${deletingClientContactCount}명의 연락처가 함께` : "가"
              } 지워지고 되살릴 수 없습니다. 이 이름으로 적힌 과정은 지워지지 않고 그대로 남습니다.`
            : undefined
        }
        confirmLabel="지우기"
        tone="danger"
      />
    </>
  );
}
