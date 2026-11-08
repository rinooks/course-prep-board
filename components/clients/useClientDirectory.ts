"use client";

// 주소록 실시간 구독. 주소록 화면, 과정 보드의 "고객사 담당자", 과정 만들기의 고객사 이름 추천이 같이 쓴다.
// 화면이 사라지면 구독을 끊고, 오류가 나면 문구와 retry()를 돌려준다 (useLiveSubscription).

import { useLiveSubscription, type LiveValue } from "@/components/board/useLiveSubscription";
import { subscribeClients, subscribeContacts } from "@/lib/data/clients";
import type { Client, ClientContact } from "@/lib/data/types";

const NO_CLIENTS: Client[] = [];
const NO_CONTACTS: ClientContact[] = [];

/** 고객사 전체 (이름순). enabled가 false면 구독하지 않는다 */
export function useClients(enabled = true): LiveValue<Client[]> {
  return useLiveSubscription(enabled ? "clients" : null, subscribeClients, NO_CLIENTS);
}

/** 모든 고객사의 담당자 (넣은 순) */
export function useAllContacts(): LiveValue<ClientContact[]> {
  return useLiveSubscription("contacts:all", (onData, onError) => subscribeContacts(onData, onError), NO_CONTACTS);
}

/** 고객사 하나의 담당자 (넣은 순). clientId가 null이면 구독하지 않는다 */
export function useClientContacts(clientId: string | null): LiveValue<ClientContact[]> {
  return useLiveSubscription(
    clientId === null ? null : `contacts:${clientId}`,
    (onData, onError) => subscribeContacts(onData, onError, clientId ?? undefined),
    NO_CONTACTS,
  );
}
