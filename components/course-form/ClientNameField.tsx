"use client";

// 과정의 "고객사" 칸. 주소록의 고객사 이름을 추천해(<datalist>) 같은 고객사를 같은 이름으로 적게 돕는다.
// 저장되는 값은 그대로 글자다 (주소록에 없는 이름도 적을 수 있다).
// 과정 정보 수정(CourseEditModal)·과정 복제(CourseCopyModal) 창의 고객사 칸도 이것으로 바꿔 쓸 수 있다.

import { useClients } from "@/components/clients/useClientDirectory";
import { describedBy, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LIMITS } from "@/lib/domain/validation";
import { clientNameHint } from "./clientNameHint";

const LOAD_FAILED_HINT = "주소록을 불러오지 못해 고객사 이름 추천이 꺼져 있습니다. 직접 입력해도 됩니다.";

interface ClientNameFieldProps {
  /** 입력칸 id (오류 칸으로 포커스를 옮길 때도 쓴다) */
  id: string;
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
}

export function ClientNameField({ id, value, error, onChange }: ClientNameFieldProps) {
  const clients = useClients();
  const listId = `${id}-suggestions`;
  const hasSuggestions = clients.loaded && clients.value.length > 0;
  const hint =
    clients.error && !clients.loaded ? LOAD_FAILED_HINT : clientNameHint(clients.loaded ? clients.value : null, value);

  return (
    <Field id={id} label="고객사" hint={hint} error={error}>
      <Input
        id={id}
        value={value}
        maxLength={LIMITS.courseClient}
        placeholder="예: A사"
        // 브라우저 자동 완성(내 회사 이름) 대신 주소록 추천이 뜨게 끈다
        autoComplete="off"
        list={hasSuggestions ? listId : undefined}
        invalid={Boolean(error)}
        aria-describedby={describedBy(id, { error, hint })}
        onChange={(event) => onChange(event.target.value)}
      />
      {hasSuggestions ? (
        <datalist id={listId}>
          {clients.value.map((client) => (
            <option key={client.id} value={client.name} />
          ))}
        </datalist>
      ) : null}
    </Field>
  );
}
