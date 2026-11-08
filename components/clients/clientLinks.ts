// 주소록 화면(/clients)으로 가는 주소.
// - ?client=고객사id : 그 고객사 카드로 옮겨 가 테두리로 표시한다 (과정 보드의 "주소록에서 보기·고치기")
// - ?new=고객사이름  : "고객사 추가" 창을 그 이름으로 채워 연다 (과정 보드의 "주소록에 추가")
// #client-id 대신 ?client=을 쓰는 이유: 로그인 화면을 거쳐 돌아올 때 #뒷부분은 사라지지만 ?뒷부분은 남는다.

export const CLIENTS_PATH = "/clients";

/** 주소에서 읽는 이름 */
export const CLIENT_PARAM = "client";
export const NEW_CLIENT_PARAM = "new";

/** 고객사 카드의 HTML id (옮겨 갈 때 찾는 이름) */
export function clientElementId(clientId: string): string {
  return `client-${clientId}`;
}

/** 주소록에서 이 고객사 카드로 가는 주소 */
export function clientHref(clientId: string): string {
  return `${CLIENTS_PATH}?${CLIENT_PARAM}=${encodeURIComponent(clientId)}`;
}

/** 주소록에 이 이름으로 고객사를 추가하는 주소 */
export function newClientHref(name: string): string {
  return `${CLIENTS_PATH}?${NEW_CLIENT_PARAM}=${encodeURIComponent(name.trim())}`;
}
