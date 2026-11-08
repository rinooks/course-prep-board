// 고객사 주소록 읽기·쓰기: clients/{clientId}, clientContacts/{contactId} (둘 다 최상위).
// - 팀원 모두가 보고 고친다. 고객사 지우기는 관리자만 (과정 지우기와 같다).
// - 담당자는 개인정보라 휴지통 없이 바로 지운다.
// - 과정과는 이름으로 맞춘다 (lib/domain/clients.ts의 findClientByName).

import { query, serverTimestamp, setDoc, updateDoc, deleteDoc, where, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { isDuplicateClientName } from "@/lib/domain/clients";
import { createId } from "@/lib/domain/ids";
import {
  validateClientInput,
  validateClientPatch,
  validateContactInput,
  validateContactPatch,
} from "@/lib/domain/validation";
import { topCol, topDoc } from "./refs";
import { toClient, toContact } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, runWrite, throwValidation } from "./write";
import type {
  Client,
  ClientContact,
  ClientInput,
  ContactInput,
  ContactUpdateInput,
  CreateOptions,
  ErrorHandler,
  Unsubscribe,
} from "./types";

function byName(a: Client, b: Client): number {
  return a.name.localeCompare(b.name, "ko");
}

function byCreated(a: ClientContact, b: ClientContact): number {
  return (a.createdAt ?? Number.MAX_SAFE_INTEGER) - (b.createdAt ?? Number.MAX_SAFE_INTEGER);
}

function duplicateNameError(name: string): never {
  throwValidation({ name: `'${name}' 고객사가 이미 있습니다. 목록에서 그 고객사에 담당자를 추가해 주세요.` });
}

/** 고객사 전체 구독 (이름순) */
export function subscribeClients(onData: (clients: Client[]) => void, onError: ErrorHandler): Unsubscribe {
  return listenQuery(
    () => topCol("clients"),
    toClient,
    (clients) => onData([...clients].sort(byName)),
    onError,
  );
}

/** 담당자 구독 (넣은 순). clientId를 주면 그 고객사의 담당자만 */
export function subscribeContacts(
  onData: (contacts: ClientContact[]) => void,
  onError: ErrorHandler,
  clientId?: string,
): Unsubscribe {
  return listenQuery(
    () => (clientId ? query(topCol("clientContacts"), where("clientId", "==", clientId)) : topCol("clientContacts")),
    toContact,
    (contacts) => onData([...contacts].sort(byCreated)),
    onError,
  );
}

/**
 * 고객사 추가. existing: 지금 화면에 있는 고객사 목록 (같은 이름이 있으면 막는다).
 * 돌려주는 값: 고객사 id
 */
export async function createClient(
  input: ClientInput,
  existing: readonly Client[],
  options: CreateOptions = {},
): Promise<string> {
  const check = validateClientInput({ name: input.name, memo: input.memo ?? "" });
  if (!check.ok) throwValidation(check.errors);
  const clientId = options.id ?? createId();
  // 같은 id로 다시 보내는 경우(응답이 늦어 다시 누름)는 자기 자신이므로 같은 이름 검사에서 뺀다
  if (isDuplicateClientName(existing, check.value.name, clientId)) duplicateNameError(check.value.name);

  const actor = requireActorEmail();
  await runWrite(
    () =>
      setDoc(topDoc("clients", clientId), {
        ...check.value,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `client:create:${clientId}`,
  );
  return clientId;
}

/** 고객사 이름·메모 고치기 */
export async function updateClient(
  clientId: string,
  patch: Partial<ClientInput>,
  existing: readonly Client[],
): Promise<void> {
  const check = validateClientPatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;
  if (check.value.name !== undefined && isDuplicateClientName(existing, check.value.name, clientId)) {
    duplicateNameError(check.value.name);
  }

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(topDoc("clients", clientId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 고객사와 그 담당자를 한 묶음으로 지운다 (관리자만). contacts: 이 고객사의 담당자 목록 */
export async function deleteClient(clientId: string, contacts: readonly ClientContact[]): Promise<void> {
  const batch = writeBatch(getDb());
  for (const contact of contacts) {
    if (contact.clientId === clientId) batch.delete(topDoc("clientContacts", contact.id));
  }
  batch.delete(topDoc("clients", clientId));
  await runWrite(() => batch.commit());
}

/** 담당자 추가. 돌려주는 값: 담당자 id */
export async function createContact(input: ContactInput, options: CreateOptions = {}): Promise<string> {
  const check = validateContactInput({
    clientId: input.clientId,
    name: input.name,
    role: input.role ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    memo: input.memo ?? "",
  });
  if (!check.ok) throwValidation(check.errors);

  const actor = requireActorEmail();
  const contactId = options.id ?? createId();
  await runWrite(
    () =>
      setDoc(topDoc("clientContacts", contactId), {
        ...check.value,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `contact:create:${contactId}`,
  );
  return contactId;
}

/** 담당자 고치기. 바꿀 칸만 넣는다 */
export async function updateContact(contactId: string, patch: ContactUpdateInput): Promise<void> {
  const check = validateContactPatch(patch);
  if (!check.ok) throwValidation(check.errors);
  if (Object.keys(check.value).length === 0) return;

  const actor = requireActorEmail();
  await runWrite(() =>
    updateDoc(topDoc("clientContacts", contactId), {
      ...check.value,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    }),
  );
}

/** 담당자 지우기 (바로 삭제) */
export async function deleteContact(contactId: string): Promise<void> {
  await runWrite(() => deleteDoc(topDoc("clientContacts", contactId)));
}
