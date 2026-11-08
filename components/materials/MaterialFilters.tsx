"use client";

// 재료 걸러 보기: 종류, 단계, 올린 사람, 제목 찾기.

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Label } from "@/components/ui/Field";
import { memberLabel } from "@/lib/data/members";
import type { Member } from "@/lib/data/types";
import {
  EMPTY_MATERIAL_FILTER,
  MATERIAL_KIND_LABELS,
  MATERIAL_KINDS,
  isMaterialKind,
  type MaterialFilter,
} from "@/lib/domain/materials";
import { STAGES, isStageId } from "@/lib/domain/stages";

interface MaterialFiltersProps {
  filter: MaterialFilter;
  onChange: (filter: MaterialFilter) => void;
  /** 올린 사람 선택지 (재료를 올린 적 있는 사람) */
  authors: readonly string[];
  members: readonly Member[];
}

export function MaterialFilters({ filter, onChange, authors, members }: MaterialFiltersProps) {
  const baseId = useId();
  const ids = { query: `${baseId}-q`, kind: `${baseId}-kind`, stage: `${baseId}-stage`, author: `${baseId}-author` };
  const active =
    filter.kind !== null || filter.stage !== null || filter.author !== null || filter.query.trim().length > 0;

  function authorLabel(email: string): string {
    const member = members.find((item) => item.email === email);
    return member ? memberLabel(member) : email;
  }

  return (
    <div role="search" aria-label="재료 찾기" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.query}>제목으로 찾기</Label>
        <Input
          id={ids.query}
          type="search"
          value={filter.query}
          placeholder="예: 킥오프"
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.kind}>종류</Label>
        <Select
          id={ids.kind}
          value={filter.kind ?? ""}
          onChange={(event) =>
            onChange({ ...filter, kind: isMaterialKind(event.target.value) ? event.target.value : null })
          }
        >
          <option value="">모든 종류</option>
          {MATERIAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {MATERIAL_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.stage}>단계</Label>
        <Select
          id={ids.stage}
          value={filter.stage ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ ...filter, stage: value === "none" ? "none" : isStageId(value) ? value : null });
          }}
        >
          <option value="">모든 단계</option>
          <option value="none">단계 없음</option>
          {STAGES.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.order}단계 · {stage.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.author}>올린 사람</Label>
        <Select
          id={ids.author}
          value={filter.author ?? ""}
          onChange={(event) => onChange({ ...filter, author: event.target.value || null })}
        >
          <option value="">모든 사람</option>
          {authors.map((email) => (
            <option key={email} value={email}>
              {authorLabel(email)}
            </option>
          ))}
        </Select>
      </div>
      <Button variant="ghost" size="sm" disabled={!active} onClick={() => onChange(EMPTY_MATERIAL_FILTER)}>
        조건 지우기
      </Button>
    </div>
  );
}
