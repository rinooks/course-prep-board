"use client";

// 과정 복제 창 (PRD F2 "과정 복제"): 지금 과정의 카드·메모·체크리스트를 복사해 새 과정을 시작한다.
// 끝냄 표시·체크·마감일과 회차 날짜는 비운다. 보관한 과정도 복제할 수 있다 (끝난 과정을 다시 쓰는 경우).

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientNameField } from "@/components/course-form/ClientNameField";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { blockImeEnterSubmit } from "@/components/ui/blockImeEnterSubmit";
import { describedBy, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { CheckboxRow } from "@/components/ui/Row";
import { useAsyncAction } from "@/components/ui/useAsyncAction";
import { useRetryId } from "@/components/ui/useRetryId";
import { useToast } from "@/components/ui/Toast";
import { duplicateCourse } from "@/lib/data/courses";
import type { Card, ChecklistItem, Course } from "@/lib/data/types";
import { copyTitle, copyWriteCount, MAX_COPY_WRITES, planCourseCopy } from "@/lib/domain/courseCopy";
import { LIMITS } from "@/lib/domain/validation";

interface CourseCopyModalProps {
  course: Course;
  cards: readonly Card[];
  checklistItems: readonly ChecklistItem[];
  /** 체크리스트를 다 받았는지. 못 받았으면 복사하면 체크리스트가 빠지므로 막는다 */
  checklistLoaded: boolean;
  onClose: () => void;
}

interface CopyDraft {
  title: string;
  client: string;
  keepAssignees: boolean;
}

export function CourseCopyModal({ course, cards, checklistItems, checklistLoaded, onClose }: CourseCopyModalProps) {
  const baseId = useId();
  const toast = useToast();
  const router = useRouter();
  const retryIds = useRetryId();
  const [draft, setDraft] = useState<CopyDraft>(() => ({
    title: copyTitle(course.title, LIMITS.courseTitle),
    client: course.client,
    keepAssignees: true,
  }));

  const plans = planCourseCopy(cards, checklistItems, { keepAssignees: draft.keepAssignees });
  const itemCount = plans.reduce((total, plan) => total + plan.checklist.length, 0);
  const tooMany = copyWriteCount(plans) > MAX_COPY_WRITES;

  const copy = useAsyncAction((current: CopyDraft, newCourseId: string) =>
    duplicateCourse(
      {
        title: current.title,
        client: current.client,
        description: course.description,
        instructorEmails: course.instructorEmails,
      },
      planCourseCopy(cards, checklistItems, { keepAssignees: current.keepAssignees }),
      { id: newCourseId },
    ),
  );

  const ids = {
    form: `${baseId}-form`,
    title: `${baseId}-title`,
    client: `${baseId}-client`,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 같은 입력으로 다시 누르면 같은 id라 과정이 두 개 생기지 않는다
    const newCourseId = retryIds.idFor(JSON.stringify(draft));
    const result = await copy.run(draft, newCourseId);
    if (!result.ok) return;
    retryIds.reset();
    toast.success("과정을 복제했습니다. 새 과정 보드로 이동합니다.");
    onClose();
    router.push(`/courses/${result.value}`);
  }

  const errors = copy.fieldErrors;
  const generalError = copy.error && Object.keys(errors).length === 0 ? copy.error : null;
  const blocked = !checklistLoaded || tooMany || plans.length === 0;

  return (
    <Modal
      open
      onClose={() => {
        if (!copy.pending) onClose();
      }}
      closeOnBackdrop={false}
      title="과정 복제"
      description="카드·메모·체크리스트 항목을 그대로 복사해 새 과정을 만듭니다."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={copy.pending}>
            취소
          </Button>
          <Button type="submit" form={ids.form} loading={copy.pending} loadingLabel="복제하는 중" disabled={blocked}>
            복제하기
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
        <Field id={ids.title} label="새 과정 이름" required error={errors.title}>
          <Input
            id={ids.title}
            value={draft.title}
            maxLength={LIMITS.courseTitle}
            invalid={Boolean(errors.title)}
            aria-describedby={describedBy(ids.title, { error: errors.title })}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
        </Field>

        <ClientNameField
          id={ids.client}
          value={draft.client}
          error={errors.client}
          onChange={(value) => setDraft((current) => ({ ...current, client: value }))}
        />

        <CheckboxRow
          checked={draft.keepAssignees}
          onChange={(checked) => setDraft((current) => ({ ...current, keepAssignees: checked }))}
          label="카드 담당자도 그대로 두기"
        />

        <Alert tone="info" title={`카드 ${plans.length}장, 체크리스트 항목 ${itemCount}개를 복사합니다.`}>
          과정 설명과 담당 강사도 그대로 가져갑니다. 끝냄 표시·체크·마감일과 회차 날짜는 비우고, 휴지통에 있는 카드는
          빼고 복사합니다.
        </Alert>

        {!checklistLoaded ? (
          <Alert tone="warning">
            체크리스트를 아직 불러오지 못해 복제할 수 없습니다. 보드의 체크리스트 오류에서 &lsquo;다시 시도&rsquo;를
            누른 뒤 다시 열어 주세요.
          </Alert>
        ) : null}
        {tooMany ? (
          <Alert tone="warning">
            카드와 체크리스트가 너무 많아 한 번에 복제할 수 없습니다. 쓰지 않는 카드를 휴지통으로 옮긴 뒤 다시 시도해
            주세요.
          </Alert>
        ) : null}
        {plans.length === 0 && checklistLoaded ? (
          <Alert tone="info">복사할 카드가 없습니다. 빈 과정은 &lsquo;새 과정 만들기&rsquo;로 만들어 주세요.</Alert>
        ) : null}
        {generalError ? (
          <Alert tone="error" title="과정을 복제하지 못했습니다">
            {generalError}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}
