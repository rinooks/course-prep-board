"use client";

// 과정의 강사료 탭 본문: 요약 3칸, 강사료 목록(미입금 → 받을 예정 → 입금됨 순), 추가·고치기·지우기.
// 강사는 자기 강사료만, 관리자는 이 과정 모든 강사의 강사료를 본다 (보안 규칙과 같은 기준으로 구독한다).

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { useToday } from "@/components/home/useToday";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlusIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { deleteFee, subscribeFees } from "@/lib/data/fees";
import { labelForEmail } from "@/lib/data/members";
import { subscribeSessions } from "@/lib/data/sessions";
import type { Course, Fee, Member, Session } from "@/lib/data/types";
import { formatDateKo, type DateString } from "@/lib/domain/dates";
import { DEFAULT_DUE_DAYS, formatWon, sortFees, suggestDueDate } from "@/lib/domain/fees";
import { feeTitle, lastSessionDate } from "./feeDisplay";
import { FeeFormModal } from "./FeeFormModal";
import { FeeRow } from "./FeeRow";
import { FeeSummaryTiles } from "./FeeSummaryTiles";

// 첫 데이터 전 값. 매번 같은 배열을 넘겨야 화면이 쓸데없이 다시 그려지지 않는다
const NO_FEES: Fee[] = [];
const NO_SESSIONS: Session[] = [];
const NO_MEMBERS: Member[] = [];

type FormState = { mode: "create"; dueDate: DateString; dueHint: string } | { mode: "edit"; fee: Fee } | null;

export function CourseFeesBody({ course }: { course: Course }) {
  const { email, isAdmin } = useAuth();
  const today = useToday();
  const toast = useToast();
  const fees = useLiveSubscription<Fee[]>(
    // 로그인한 사람·관리자 여부가 바뀌면 구독 조건도 바뀐다
    email ? `${course.id}|${email}|${isAdmin ? "admin" : "instructor"}` : null,
    (onData, onError) => subscribeFees({ email: email ?? "", isAdmin, courseId: course.id }, onData, onError),
    NO_FEES,
  );
  // 입금 예정일 처음 값(마지막 강의 날 + 30일)에만 쓴다. 못 받으면 오늘부터 센다
  const sessions = useLiveSubscription<Session[]>(
    course.id,
    (onData, onError) => subscribeSessions(course.id, onData, onError),
    NO_SESSIONS,
  );
  // 이름 표시용. 못 받아도 이메일로 보여 주므로 오류는 따로 알리지 않는다
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<Fee | null>(null);

  const sorted = useMemo(() => (today ? sortFees(fees.value, today) : NO_FEES), [fees.value, today]);

  function openCreate() {
    if (!today) return;
    const lastDate = lastSessionDate(sessions.value);
    setForm({
      mode: "create",
      dueDate: suggestDueDate(lastDate, today),
      dueHint: lastDate
        ? `마지막 강의 날(${formatDateKo(lastDate)})부터 ${DEFAULT_DUE_DAYS}일 뒤로 넣어 두었습니다.`
        : `오늘부터 ${DEFAULT_DUE_DAYS}일 뒤로 넣어 두었습니다. 강의 날짜에 맞게 고쳐 주세요.`,
    });
  }

  const retryButton = (
    <Button variant="outline" size="sm" onClick={fees.retry}>
      다시 시도
    </Button>
  );

  const addButton = (
    <Button size="sm" onClick={openCreate} disabled={!today || !email}>
      <PlusIcon />
      강사료 추가
    </Button>
  );

  const description = isAdmin
    ? "금액은 강사 본인과 관리자만 볼 수 있습니다. 관리자에게는 이 과정 모든 강사의 강사료가 보입니다."
    : "금액은 강사 본인과 관리자만 볼 수 있습니다. 다른 강사의 강사료는 보이지 않습니다.";

  return (
    <>
      <Section
        title="강사료"
        meta={fees.loaded ? `${fees.value.length}건` : undefined}
        description={description}
        action={addButton}
      >
        {fees.error ? (
          <Alert
            tone={fees.loaded ? "warning" : "error"}
            title={fees.loaded ? "실시간 연결이 끊겼습니다" : "강사료를 불러오지 못했습니다"}
            action={retryButton}
          >
            {fees.loaded ? `보이는 강사료가 최신이 아닐 수 있습니다. ${fees.error}` : fees.error}
          </Alert>
        ) : null}

        {(!fees.loaded || !today) && !fees.error ? <InlineLoading label="강사료를 불러오는 중입니다…" /> : null}

        {fees.loaded && today ? (
          <>
            <FeeSummaryTiles fees={fees.value} today={today} />
            {sorted.length === 0 ? (
              <EmptyState
                title="아직 등록한 강사료가 없습니다"
                description={`'강사료 추가'를 눌러 받을 금액과 입금 예정일을 적어 두세요. 예정일이 지나도 입금 확인을 하지 않으면 '미입금'으로 표시되어 놓치지 않습니다.`}
                action={addButton}
              />
            ) : (
              <Card padding="none">
                <ul aria-label="강사료 목록" className="divide-y divide-line">
                  {sorted.map((fee) => (
                    <FeeRow
                      key={fee.id}
                      fee={fee}
                      today={today}
                      instructorLabel={isAdmin ? labelForEmail(fee.instructorEmail, members) : null}
                      onEdit={() => setForm({ mode: "edit", fee })}
                      onDelete={() => setDeleting(fee)}
                    />
                  ))}
                </ul>
              </Card>
            )}
          </>
        ) : null}
      </Section>

      {form && email && today ? (
        <FeeFormModal
          // 다른 강사료를 열면 입력 상태를 새로 시작한다
          key={form.mode === "edit" ? form.fee.id : "new"}
          courseId={course.id}
          fee={form.mode === "edit" ? form.fee : null}
          courseInstructors={course.instructorEmails}
          defaultDueDate={form.mode === "create" ? form.dueDate : today}
          dueDateHint={form.mode === "create" ? form.dueHint : undefined}
          me={email}
          isAdmin={isAdmin}
          members={team.members}
          today={today}
          onClose={() => setForm(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await deleteFee(deleting.id);
          toast.success(`‘${feeTitle(deleting)}’ 강사료를 지웠습니다.`);
        }}
        title="이 강사료를 지울까요?"
        description={
          deleting
            ? `‘${feeTitle(deleting)}’ ${formatWon(deleting.amount)}이 바로 지워지고 되살릴 수 없습니다. 입금 여부만 바꾸려면 '입금 확인'이나 '입금 취소'를 눌러 주세요.`
            : undefined
        }
        confirmLabel="지우기"
        tone="danger"
      />
    </>
  );
}
