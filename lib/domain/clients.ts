// 고객사 주소록: 고객사 이름 맞추기, 담당자 전화번호 다루기.
// 과정은 고객사를 id가 아니라 이름(course.client)으로 가리킨다. 그래서 이름을 느슨하게 맞춘다:
// 대소문자·띄어쓰기·"(주)"·"주식회사" 차이는 같은 고객사로 본다.

export interface ClientLike {
  id: string;
  name: string;
}

const COMPANY_MARKS = /\(주\)|㈜|주식회사|\(유\)|유한회사/g;

/** 고객사 이름 비교용 열쇠: "삼성전자(주)", " 삼성 전자 " → "삼성전자" */
export function clientNameKey(name: string): string {
  return name.normalize("NFKC").replace(COMPANY_MARKS, "").replace(/\s+/g, "").toLowerCase();
}

/** 과정의 고객사 이름에 맞는 주소록 고객사. 없거나 이름이 비었으면 null */
export function findClientByName<T extends ClientLike>(clients: readonly T[], name: string): T | null {
  const key = clientNameKey(name);
  if (key.length === 0) return null;
  return clients.find((client) => clientNameKey(client.name) === key) ?? null;
}

/** 같은 이름의 고객사가 이미 있는지 (고칠 때는 자기 자신 exceptId를 뺀다) */
export function isDuplicateClientName(clients: readonly ClientLike[], name: string, exceptId?: string): boolean {
  const key = clientNameKey(name);
  if (key.length === 0) return false;
  return clients.some((client) => client.id !== exceptId && clientNameKey(client.name) === key);
}

/** 이 고객사의 과정들 (이름으로 맞춘다) */
export function coursesOfClient<T extends { client: string }>(courses: readonly T[], client: ClientLike): T[] {
  const key = clientNameKey(client.name);
  if (key.length === 0) return [];
  return courses.filter((course) => clientNameKey(course.client) === key);
}

/** 전화번호에 쓸 수 있는 글자: 숫자, +, -, 괄호, 점, 띄어쓰기. 내선 등은 메모에 */
export const PHONE_PATTERN = /^[0-9+().\- ]*$/;

export function isPhoneValue(value: string): boolean {
  return PHONE_PATTERN.test(value) && (value.length === 0 || /\d/.test(value));
}

/** 전화 걸기 링크: "010-1234-5678" → "tel:01012345678". 숫자가 없으면 null */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^0-9+]/g, "");
  return /\d/.test(digits) ? `tel:${digits}` : null;
}

/** 메일 쓰기 링크 */
export function mailtoHref(email: string): string | null {
  return email.length > 0 ? `mailto:${email}` : null;
}
