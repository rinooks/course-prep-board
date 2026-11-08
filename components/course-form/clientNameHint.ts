// 과정의 고객사 칸 아래 안내 문구: 적은 이름이 주소록의 고객사와 이어지는지 알려 준다.
// 과정은 고객사를 이름으로 가리키므로, 주소록과 같은 이름을 쓰게 돕는다 (저장 값은 그대로 글자다).

import { findClientByName, type ClientLike } from "@/lib/domain/clients";

/**
 * @param clients 주소록 고객사. 아직 못 받았거나 못 불러왔으면 null (안내하지 않는다)
 * @param value 고객사 칸에 적은 값
 */
export function clientNameHint(clients: readonly ClientLike[] | null, value: string): string | null {
  if (clients === null) return null;
  const name = value.trim();
  if (name.length === 0) {
    return clients.length > 0 ? "입력하면 주소록에 있는 고객사 이름이 추천됩니다." : null;
  }
  const match = findClientByName(clients, name);
  if (!match) {
    return "주소록에 아직 없는 이름입니다. 새 고객사라면 그대로 두고, 과정 보드에서 주소록에 추가할 수 있습니다.";
  }
  if (match.name === name) {
    return "주소록에 있는 고객사입니다. 과정 보드에 담당자 연락처가 함께 보입니다.";
  }
  return `주소록의 ‘${match.name}’ 고객사와 이어집니다. 과정 보드에 담당자 연락처가 함께 보입니다.`;
}
