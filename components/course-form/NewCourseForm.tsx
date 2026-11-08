"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { describedBy, Field } from "@/components/ui/Field";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { createCourse } from "@/lib/data/courses";
import type { CourseCreateInput } from "@/lib/data/types";
import { hasErrors, LIMITS, type FieldErrors } from "@/lib/domain/validation";
import {
  firstErrorField,
  formErrorsFromSaveErrors,
  initialCourseFormValues,
  validateCourseForm,
  type CourseFormField,
  type CourseFormValues,
} from "./courseFormState";
import { ClientNameField } from "./ClientNameField";
import { courseFormFieldIds } from "./fieldIds";
import { FIELDSET_LEGEND_CLASS } from "./fieldsetLegend";
import { FirstSessionFields } from "./FirstSessionFields";
import { InstructorPicker } from "./InstructorPicker";
import { StageNotice } from "./StageNotice";

const IDS = courseFormFieldIds("new-course");
const DESCRIPTION_HINT = "교육 목표, 고객사 요청처럼 팀이 함께 알아야 할 내용을 적어 두세요.";

/** 과정 만들기 폼. 저장에 성공하면 새 과정 보드로 이동한다. */
export function NewCourseForm() {
  const router = useRouter();
  const toast = useToast();
  const { email } = useAuth();
  const team = useTeamMembers();

  const [values, setValues] = useState<CourseFormValues>(() => initialCourseFormValues(email));
  const [clientErrors, setClientErrors] = useState<FieldErrors<CourseFormField>>({});
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);

  // 과정 id: 같은 입력으로 다시 시도하면 같은 id(중복 과정 방지), 입력을 고쳤으면 새 id.
  const retryIds = useRetryId();
  // 성공한 뒤 이 화면을 떠나면 폼을 비운다 (cacheComponents는 떠난 화면의 입력값을 그대로 보존한다)
  const resetOnHideRef = useRef(false);

  const {
    run: runCreate,
    pending: saving,
    error: saveError,
    fieldErrors: saveFieldErrors,
    reset: resetSave,
  } = useAsyncAction((input: CourseCreateInput, courseId: string) => createCourse(input, { id: courseId }));

  useLayoutEffect(() => {
    return () => {
      if (!resetOnHideRef.current) return;
      resetOnHideRef.current = false;
      retryIds.reset();
      setValues(initialCourseFormValues(email));
      setClientErrors({});
      setCreatedCourseId(null);
      resetSave();
    };
  }, [email, resetSave, retryIds]);

  const errors: FieldErrors<CourseFormField> = {
    ...formErrorsFromSaveErrors(saveFieldErrors),
    ...clientErrors,
  };

  function updateField<K extends CourseFormField>(field: K, value: CourseFormValues[K]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setClientErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function focusField(field: CourseFormField | null) {
    if (!field) return;
    document.getElementById(IDS[field])?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const check = validateCourseForm(values);
    if (!check.ok) {
      setClientErrors(check.errors);
      focusField(firstErrorField(check.errors));
      return;
    }
    setClientErrors({});

    const courseId = retryIds.idFor(JSON.stringify(check.value));

    const result = await runCreate(check.value, courseId);
    if (!result.ok) return;

    resetOnHideRef.current = true;
    setCreatedCourseId(result.value);
    toast.success("과정을 만들었습니다. 7단계 칸과 기본 카드가 준비되어 있습니다.");
    router.push(`/courses/${result.value}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="새 과정"
        title="새 과정 만들기"
        description="과정 이름만 있으면 바로 만들 수 있습니다. 나머지는 나중에 과정 보드에서 채워도 됩니다."
      />
      <PageBody>
        <StageNotice />

        <form noValidate onSubmit={handleSubmit} onKeyDown={blockImeEnterSubmit} className="flex flex-col gap-6">
          <Card>
            <fieldset disabled={saving} className="flex min-w-0 flex-col gap-8">
              <fieldset className="flex min-w-0 flex-col gap-4">
                <legend className={FIELDSET_LEGEND_CLASS}>과정 정보</legend>

                <Field id={IDS.title} label="과정 이름" required error={errors.title}>
                  <Input
                    id={IDS.title}
                    value={values.title}
                    maxLength={LIMITS.courseTitle}
                    placeholder="예: A사 신입사원 AI 활용 과정"
                    autoComplete="off"
                    required
                    invalid={Boolean(errors.title)}
                    aria-describedby={describedBy(IDS.title, { error: errors.title })}
                    onChange={(event) => updateField("title", event.target.value)}
                  />
                </Field>

                <ClientNameField
                  id={IDS.client}
                  value={values.client}
                  error={errors.client}
                  onChange={(value) => updateField("client", value)}
                />

                <Field id={IDS.description} label="설명" hint={DESCRIPTION_HINT} error={errors.description}>
                  <Textarea
                    id={IDS.description}
                    value={values.description}
                    maxLength={LIMITS.courseDescription}
                    invalid={Boolean(errors.description)}
                    aria-describedby={describedBy(IDS.description, {
                      error: errors.description,
                      hint: DESCRIPTION_HINT,
                    })}
                    onChange={(event) => updateField("description", event.target.value)}
                  />
                </Field>
              </fieldset>

              <InstructorPicker
                id={IDS.instructorEmails}
                members={team.members}
                membersError={team.error}
                onRetryMembers={team.retry}
                selected={values.instructorEmails}
                onChange={(next) => updateField("instructorEmails", next)}
                error={errors.instructorEmails}
              />

              <FirstSessionFields
                ids={IDS}
                values={values}
                errors={errors}
                onChange={(field, value) => updateField(field, value)}
              />
            </fieldset>
          </Card>

          {saveError ? (
            <Alert tone="error" title="과정을 만들지 못했습니다">
              {hasErrors(saveFieldErrors) ? "빨간 안내가 있는 칸을 고친 뒤 다시 만들어 주세요." : saveError}
            </Alert>
          ) : null}

          {createdCourseId ? (
            <Alert
              tone="success"
              title="과정을 만들었습니다"
              action={
                <ButtonLink href={`/courses/${createdCourseId}`} variant="outline" size="sm">
                  보드 열기
                </ButtonLink>
              }
            >
              과정 보드로 이동하는 중입니다…
            </Alert>
          ) : null}

          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <ButtonLink href="/" variant="outline">
              취소
            </ButtonLink>
            <Button type="submit" loading={saving} loadingLabel="과정을 만드는 중">
              과정 만들기
            </Button>
          </div>
        </form>
      </PageBody>
    </>
  );
}
