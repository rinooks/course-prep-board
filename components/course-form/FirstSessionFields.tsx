"use client";

import { describedBy, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { LIMITS, type FieldErrors } from "@/lib/domain/validation";
import type { CourseFormField, CourseFormValues } from "./courseFormState";
import type { CourseFormFieldIds } from "./fieldIds";
import { FIELDSET_LEGEND_CLASS } from "./fieldsetLegend";

export type SessionField = "sessionDate" | "sessionStartTime" | "sessionLocation" | "sessionAudience";

interface FirstSessionFieldsProps {
  ids: CourseFormFieldIds;
  values: Pick<CourseFormValues, SessionField>;
  errors: FieldErrors<CourseFormField>;
  onChange: (field: SessionField, value: string) => void;
}

const DATE_HINT = "비워 두면 회차 없이 만들고, 보드에서 나중에 추가할 수 있습니다.";

/** 첫 강의 일정(선택): 날짜, 시작 시간, 장소, 대상 */
export function FirstSessionFields({ ids, values, errors, onChange }: FirstSessionFieldsProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={FIELDSET_LEGEND_CLASS}>
        첫 강의 일정 <span className="text-sm font-normal tracking-normal text-muted">(선택)</span>
      </legend>
      <p className="text-sm text-muted">
        날짜를 넣으면 홈에서 다음 강의가 가까운 순으로 정렬됩니다. 같은 과정을 여러 번 진행하면 보드에서 회차를 더
        추가하세요.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id={ids.sessionDate} label="강의 날짜" hint={DATE_HINT} error={errors.sessionDate}>
          <Input
            id={ids.sessionDate}
            type="date"
            value={values.sessionDate}
            invalid={Boolean(errors.sessionDate)}
            aria-describedby={describedBy(ids.sessionDate, { error: errors.sessionDate, hint: DATE_HINT })}
            onChange={(event) => onChange("sessionDate", event.target.value)}
          />
        </Field>

        <Field id={ids.sessionStartTime} label="시작 시간" error={errors.sessionStartTime}>
          <Input
            id={ids.sessionStartTime}
            type="time"
            value={values.sessionStartTime}
            invalid={Boolean(errors.sessionStartTime)}
            aria-describedby={describedBy(ids.sessionStartTime, { error: errors.sessionStartTime })}
            onChange={(event) => onChange("sessionStartTime", event.target.value)}
          />
        </Field>

        <Field id={ids.sessionLocation} label="장소" error={errors.sessionLocation}>
          <Input
            id={ids.sessionLocation}
            value={values.sessionLocation}
            maxLength={LIMITS.sessionLocation}
            placeholder="예: A사 본사 10층 교육장"
            invalid={Boolean(errors.sessionLocation)}
            aria-describedby={describedBy(ids.sessionLocation, { error: errors.sessionLocation })}
            onChange={(event) => onChange("sessionLocation", event.target.value)}
          />
        </Field>

        <Field id={ids.sessionAudience} label="대상" error={errors.sessionAudience}>
          <Input
            id={ids.sessionAudience}
            value={values.sessionAudience}
            maxLength={LIMITS.sessionAudience}
            placeholder="예: 신입사원 30명"
            invalid={Boolean(errors.sessionAudience)}
            aria-describedby={describedBy(ids.sessionAudience, { error: errors.sessionAudience })}
            onChange={(event) => onChange("sessionAudience", event.target.value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
