// 주소록 찾기: 고객사 이름, 담당자 이름·부서·직책·이메일·전화번호로 찾는다.
// - 고객사 이름이 맞으면 그 고객사의 담당자를 모두 보여 준다.
// - 담당자만 맞으면 맞는 담당자만 골라 보여 준다 (filtered: true).
// - 띄어쓰기·대소문자·전각 글자 차이는 무시한다. 고객사 이름은 "(주)"·"주식회사"도 무시한다.
// - 전화번호는 숫자만 비교한다: "1234 5678"로 "010-1234-5678"을 찾는다.

import { clientNameKey } from "@/lib/domain/clients";

export interface SearchableClient {
  id: string;
  name: string;
}

export interface SearchableContact {
  clientId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface ClientSearchResult<C, P> {
  client: C;
  /** 화면에 보일 담당자 */
  contacts: P[];
  /** 이 고객사의 전체 담당자 수 */
  totalContacts: number;
  /** true면 검색과 맞는 담당자만 골라 보여 주는 중 */
  filtered: boolean;
}

/** 비교용 글자: 전각 → 반각, 소문자, 띄어쓰기 제거 */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

const PHONE_QUERY_PATTERN = /^[0-9+().\- ]+$/;

/** 전화번호처럼 보이는 검색어(숫자와 - ( ) . + 띄어쓰기만)면 그 숫자들, 아니면 null */
function phoneQueryDigits(query: string): string | null {
  const text = query.normalize("NFKC").trim();
  if (!PHONE_QUERY_PATTERN.test(text)) return null;
  const digits = digitsOf(text);
  return digits.length > 0 ? digits : null;
}

/** 검색어가 비었는지 (띄어쓰기만 있어도 빈 것으로 본다) */
export function isBlankQuery(query: string): boolean {
  return normalizeSearchText(query).length === 0;
}

/** 고객사 이름이 검색어와 맞는지 */
export function clientNameMatchesQuery(name: string, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (needle.length === 0) return true;
  if (normalizeSearchText(name).includes(needle)) return true;
  // "삼성전자(주)"로 찾아도 "삼성전자"가 나오게
  const key = clientNameKey(query);
  return key.length > 0 && clientNameKey(name).includes(key);
}

/** 담당자가 검색어와 맞는지: 이름, 부서·직책, 이메일, 전화번호(숫자만) */
export function contactMatchesQuery(contact: SearchableContact, query: string): boolean {
  const needle = normalizeSearchText(query);
  if (needle.length === 0) return true;
  const texts = [contact.name, contact.role, contact.email];
  if (texts.some((text) => normalizeSearchText(text).includes(needle))) return true;
  const digits = phoneQueryDigits(query);
  return digits !== null && digitsOf(contact.phone).includes(digits);
}

/** 담당자를 고객사별로 묶는다. 한 고객사 안의 순서는 받은 순서 그대로 */
export function groupContactsByClient<P extends { clientId: string }>(contacts: readonly P[]): Map<string, P[]> {
  const groups = new Map<string, P[]>();
  for (const contact of contacts) {
    const list = groups.get(contact.clientId);
    if (list) list.push(contact);
    else groups.set(contact.clientId, [contact]);
  }
  return groups;
}

/** 검색 결과. 고객사 순서는 받은 순서(이름순) 그대로 */
export function searchClients<C extends SearchableClient, P extends SearchableContact>(
  clients: readonly C[],
  contactsByClient: ReadonlyMap<string, readonly P[]>,
  query: string,
): ClientSearchResult<C, P>[] {
  const searching = !isBlankQuery(query);
  const results: ClientSearchResult<C, P>[] = [];

  for (const client of clients) {
    const all = contactsByClient.get(client.id) ?? [];
    if (!searching || clientNameMatchesQuery(client.name, query)) {
      results.push({ client, contacts: [...all], totalContacts: all.length, filtered: false });
      continue;
    }
    const matched = all.filter((contact) => contactMatchesQuery(contact, query));
    if (matched.length > 0) {
      results.push({ client, contacts: matched, totalContacts: all.length, filtered: true });
    }
  }
  return results;
}
