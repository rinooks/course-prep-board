"use client";

// 과정 정보 수정 창: 과정 이름, 고객사, 설명, 담당 강사.
// 창을 연 뒤 바꾼 칸만 저장해서, 그사이 다른 강사가 고친 다른 칸을 덮어쓰지 않는다.

import { useId, useState, type FormEvent } from "react";
import { ClientNameField } from "@/components/course-form/ClientNameField";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { describedBy, Field, FieldError } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CheckboxRow } from "@/components/ui/Row";
import { InlineLoading } from "@/components/ui/Spinner";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useToast } from "@/components/ui/Toast";
import { updateCourse } from "@/lib/data/courses";
import { memberLabel } from "@/lib/data/members";
import type { Course, CourseUpdateInput, Member } from "@/lib/data/types";
import { LIMITS } from "@/lib/domain/validation";

interface CourseEditModalProps {
  course: Course;
  members: readonly Member[];
  membersLoaded: boolean;
  onClose: () => void;
}

interface CourseDraft {
  title: string;
  client: string;
  description: string;
  instructorEmails: string[];
}

function draftFrom(course: Course): CourseDraft {
  return {
    title: course.title,
    client: course.client,
    description: course.description,
    instructorEmails: [...course.instructorEmails],
  };
}

function sameEmails(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((email, index) => email === sortedB[index]);
}

function changedFields(initial: CourseDraft, current: CourseDraft): CourseUpdateInput {
  const patch: CourseUpdateInput = {};
  if (current.title !== initial.title) patch.title = current.title;
  if (current.client !== initial.client) patch.client = current.client;
  if (current.description !== initial.description) patch.description = current.description;
  if (!sameEmails(current.instructorEmails, initial.instructorEmails)) {
    patch.instructorEmails = current.instructorEmails;
  }
  return patch;
}

interface InstructorChoice {
  email: string;
  label: string;
  missing: boolean;
}

/** 담당 강사 선택지: 팀원 전체 + (팀에서 나간 사람이 지정돼 있으면) 그 이메일 */
function instructorChoices(members: readonly Member[], selected: readonly string[]): InstructorChoice[] {
  const choices: InstructorChoice[] = members.map((member) => ({
    email: member.email,
    label: memberLabel(member),
    missing: false,
  }));
  for (const email of selected) {
    if (!members.some((member) => member.email === email)) {
      choices.push({ email, label: email, missing: true });
    }
  }
  return choices;
}

export function CourseEditModal({ course, members, membersLoaded, onClose }: CourseEditModalProps) {
  const baseId = useId();
  const toast = useToast();
  const [initial] = useState<CourseDraft>(() => draftFrom(course));
  const [draft, setDraft] = useState<CourseDraft>(initial);

  const save = useAsyncAction((current: CourseDraft) => updateCourse(course.id, changedFields(initial, current)));

  const ids = {
    form: `${baseId}-form`,
    title: `${baseId}-title`,
    client: `${baseId}-client`,
    description: `${baseId}-description`,
    instructors: `${baseId}-instructors`,
  };

  function change(field: "title" | "client" | "description", value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleInstructor(email: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      instructorEmails: checked
        ? [...current.instructorEmails.filter((item) => item !== email), email]
        : current.instructorEmails.filter((item) => item !== email),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await save.run(draft);
    if (result.ok) {
      toast.success("과정 정보를 저장했습니다.");
      onClose();
    }
  }

  const errors = save.fieldErrors;
  const generalError = save.error && Object.keys(errors).length === 0 ? save.error : null;
  const choices = instructorChoices(members, draft.instructorEmails);
  const atLimit = draft.instructorEmails.length >= LIMITS.instructors;

  return (
    <Modal
      open
      onClose={() => {
        if (!save.pending) onClose();
      }}
      closeOnBackdrop={false}
      size="lg"
      title="과정 정보 수정"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.pending}>
            취소
          </Button>
          <Button type="submit" form={ids.form} loading={save.pending} loadingLabel="저장하는 중">
            저장
          </Button>
        </>
      }
    >
      <form
        id={ids.form}
        onSubmit={handleSubmit}
        onKeyDown={blockImeEnterSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field id={ids.title} label="과정 이름" required error={errors.title}>
          <Input
            id={ids.title}
            value={draft.title}
            maxLength={LIMITS.courseTitle}
            invalid={Boolean(errors.title)}
            aria-describedby={describedBy(ids.title, { error: errors.title })}
            onChange={(event) => change("title", event.target.value)}
          />
        </Field>

        <ClientNameField
          id={ids.client}
          value={draft.client}
          error={errors.client}
          onChange={(value) => change("client", value)}
        />

        <Field id={ids.description} label="과정 설명" error={errors.description}>
          <Textarea
            id={ids.description}
            rows={4}
            value={draft.description}
            maxLength={LIMITS.courseDescription}
            invalid={Boolean(errors.description)}
            aria-describedby={describedBy(ids.description, { error: errors.description })}
            onChange={(event) => change("description", event.target.value)}
          />
        </Field>

        <fieldset
          className="flex flex-col gap-2"
          aria-describedby={describedBy(ids.instructors, { error: errors.instructorEmails })}
        >
          {/* 제목은 카드 안 작은 구역 제목(SectionHeading h3)과 같은 모양, 고른 수는 옆에 작게 */}
          <legend className="mb-1 text-base font-bold tracking-tight text-ink">
            담당 강사{" "}
            <span className="ml-1 text-sm font-semibold tracking-normal text-muted tabular-nums">
              {draft.instructorEmails.length}명 선택
            </span>
          </legend>
          {!membersLoaded ? <InlineLoading label="팀원 목록을 불러오는 중입니다…" /> : null}
          {membersLoaded && choices.length === 0 ? (
            <p className="text-sm text-muted">팀원이 없습니다. 관리자 화면에서 강사를 먼저 초대해 주세요.</p>
          ) : null}
          {choices.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {choices.map((choice) => {
                const checked = draft.instructorEmails.includes(choice.email);
                const showEmail = choice.label !== choice.email;
                return (
                  <li key={choice.email}>
                    <CheckboxRow
                      boxed
                      checked={checked}
                      disabled={!checked && atLimit}
                      onChange={(next) => toggleInstructor(choice.email, next)}
                      label={showEmail ? choice.label : <span className="break-anywhere">{choice.label}</span>}
                      description={
                        showEmail || choice.missing ? (
                          <>
                            {showEmail ? <span className="block break-anywhere">{choice.email}</span> : null}
                            {choice.missing ? <span className="block">팀원 목록에 없음</span> : null}
                          </>
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
          {atLimit ? (
            <p className="text-sm text-muted">담당 강사는 {LIMITS.instructors}명까지 고를 수 있습니다.</p>
          ) : null}
          <FieldError id={ids.instructors}>{errors.instructorEmails}</FieldError>
        </fieldset>

        {generalError ? (
          <Alert tone="error" title="과정 정보를 저장하지 못했습니다">
            {generalError}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}
