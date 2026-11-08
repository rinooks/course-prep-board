"use client";

// /courses/[courseId]/outputs/[outputId]/print — 결과물을 PDF로 저장하는 인쇄 화면 (PRD F7).
// 새 탭에서 열린다. 앱 머리글(AppShell) 없이 문서만 보여 주고, 다 그려지면 인쇄 창을 한 번 자동으로 연다.
// 브라우저 인쇄 창에서 "PDF로 저장"을 고르면 PDF가 된다 (서버에서 PDF를 만들지 않는다).
// 팀원만 볼 수 있다 (RequireMember + Firestore 보안 규칙).

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { RequireMember } from "@/components/auth/RequireMember";
import { useLiveSubscription } from "@/components/board/useLiveSubscription";
import { courseTabHref } from "@/components/course/CourseTabs";
import { useTeamMembers } from "@/components/home/useTeamMembers";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { subscribeCourse } from "@/lib/data/courses";
import { subscribeOutputs } from "@/lib/data/drafts";
import type { Course, Member, Output } from "@/lib/data/types";
import { exportBaseName } from "@/lib/domain/exportFiles";
import { isSafeId } from "@/lib/domain/ids";
import { OutputPrintDocument } from "./OutputPrintDocument";
import { useAutoPrint } from "./useAutoPrint";

/** 종이 크기와 여백. 브라우저 인쇄 창의 기본값 대신 이 값을 쓴다 */
const PAGE_STYLE = "@page { size: A4; margin: 16mm; }";

const NO_OUTPUTS: Output[] = [];
const NO_MEMBERS: Member[] = [];

export function OutputPrintScreen() {
  const params = useParams<{ courseId: string; outputId: string }>();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";
  const outputId = typeof params.outputId === "string" ? params.outputId : "";

  return (
    <RequireMember>
      <OutputPrintView key={`${courseId}/${outputId}`} courseId={courseId} outputId={outputId} />
    </RequireMember>
  );
}

function OutputPrintView({ courseId, outputId }: { courseId: string; outputId: string }) {
  const validIds = isSafeId(courseId) && isSafeId(outputId);
  const course = useLiveSubscription<Course | null>(
    validIds ? courseId : null,
    (onData, onError) => subscribeCourse(courseId, onData, onError),
    null,
  );
  const outputs = useLiveSubscription<Output[]>(
    validIds ? courseId : null,
    (onData, onError) => subscribeOutputs(courseId, onData, onError),
    NO_OUTPUTS,
  );
  const team = useTeamMembers();
  const members = team.members ?? NO_MEMBERS;

  const output = outputs.value.find((item) => item.id === outputId) ?? null;
  const courseValue = course.value;
  const ready =
    validIds &&
    course.loaded &&
    outputs.loaded &&
    courseValue !== null &&
    courseValue.deletedAt === null &&
    output !== null &&
    output.deletedAt === null;

  // 인쇄 창의 "PDF로 저장"은 문서 제목을 기본 파일 이름으로 쓴다: "{과정 이름}_{종류}_{N}판"
  const fileTitle = ready && courseValue && output ? exportBaseName(courseValue.title, output.kind, output.version) : null;
  useEffect(() => {
    if (!fileTitle) return;
    const previous = document.title;
    document.title = fileTitle;
    return () => {
      document.title = previous;
    };
  }, [fileTitle]);

  useAutoPrint(ready);

  const outputsHref = courseTabHref(courseId, "outputs");
  const backLink = (
    <ButtonLink href={outputsHref} variant="outline">
      결과물 탭으로
    </ButtonLink>
  );

  if (!validIds) {
    return (
      <PrintNotice
        title="결과물을 찾을 수 없습니다"
        description="주소가 잘못되었습니다. 과정의 결과물 탭에서 'PDF로 저장'을 다시 눌러 주세요."
        action={
          <ButtonLink href="/" variant="outline">
            홈으로
          </ButtonLink>
        }
      />
    );
  }

  const loadError = (!course.loaded && course.error) || (!outputs.loaded && outputs.error);
  if (loadError) {
    return (
      <PrintFrame>
        <Alert
          tone="error"
          title="인쇄할 내용을 불러오지 못했습니다"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                course.retry();
                outputs.retry();
              }}
            >
              다시 시도
            </Button>
          }
        >
          {loadError}
        </Alert>
      </PrintFrame>
    );
  }

  if (!course.loaded || !outputs.loaded) {
    return <LoadingBlock fullScreen label="인쇄할 내용을 불러오는 중입니다…" />;
  }

  if (courseValue === null || courseValue.deletedAt !== null) {
    return (
      <PrintNotice
        title={courseValue === null ? "과정을 찾을 수 없습니다" : `'${courseValue.title}' 과정은 휴지통에 있습니다`}
        description="과정이 지워졌거나 휴지통에 있어 인쇄할 수 없습니다. 홈이나 보관함에서 과정을 확인해 주세요."
        action={
          <ButtonLink href="/" variant="outline">
            홈으로
          </ButtonLink>
        }
      />
    );
  }

  if (output === null) {
    return (
      <PrintNotice
        title="결과물을 찾을 수 없습니다"
        description="주소가 잘못되었거나 결과물이 없습니다. 결과물 탭에서 'PDF로 저장'을 다시 눌러 주세요."
        action={backLink}
      />
    );
  }

  if (output.deletedAt !== null) {
    return (
      <PrintNotice
        title="휴지통에 있는 결과물입니다"
        description="결과물 탭 맨 아래 '휴지통'에서 되살린 뒤 다시 'PDF로 저장'을 눌러 주세요."
        action={backLink}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-surface print:bg-white">
      <style>{PAGE_STYLE}</style>
      <PrintToolbar outputsHref={outputsHref} />
      <main className="mx-auto w-full max-w-[210mm] px-4 py-6 print:max-w-none print:p-0">
        {outputs.error || course.error ? (
          <Alert tone="warning" title="실시간 연결이 끊겼습니다" className="mb-4 print:hidden">
            보이는 내용이 최신이 아닐 수 있습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.
          </Alert>
        ) : null}
        <OutputPrintDocument course={courseValue} output={output} members={members} />
      </main>
    </div>
  );
}

/** 화면 위쪽 도구 줄. 인쇄할 때는 숨긴다 */
function PrintToolbar({ outputsHref }: { outputsHref: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-md print:hidden">
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">인쇄 창에서 &apos;대상&apos;을 &apos;PDF로 저장&apos;으로 고르세요.</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ButtonLink href={outputsHref} variant="outline" size="sm">
            결과물 탭으로
          </ButtonLink>
          <Button size="sm" onClick={() => window.print()}>
            인쇄 / PDF로 저장
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 문서 대신 안내를 보여 줄 때의 틀 (머리글 없는 화면이라 가운데 좁은 폭) */
function PrintFrame({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-12">{children}</main>;
}

function PrintNotice({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <PrintFrame>
      <EmptyState title={title} description={description} action={action} />
    </PrintFrame>
  );
}
