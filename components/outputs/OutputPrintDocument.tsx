"use client";

// 결과물 인쇄용 A4 문서: 과정 이름, 종류·판 번호, 확정한 날, 본문.
// 화면에서는 회색 바탕 위 흰 종이처럼 보이고, 인쇄할 때는 테두리·그림자·여백을 빼서 종이 여백(@page 16mm)만 남긴다.

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Course, Member, Output } from "@/lib/data/types";
import { DRAFT_KIND_LABELS } from "@/lib/domain/drafts";
import { OutputContent } from "./OutputContent";
import { authorLabel, confirmedDateLabel, versionLabel } from "./outputLabels";

interface OutputPrintDocumentProps {
  course: Course;
  output: Output;
  members: readonly Member[];
}

export function OutputPrintDocument({ course, output, members }: OutputPrintDocumentProps) {
  return (
    <Card padding="none" className="print:rounded-none print:border-0 print:shadow-none">
      <article className="flex flex-col gap-6 p-8 print:p-0">
        <header className="flex flex-col gap-2 border-b border-line pb-4">
          {course.client ? <p className="text-sm font-semibold text-muted">{course.client}</p> : null}
          <h1 className="text-3xl font-bold tracking-tight text-ink text-balance">{course.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
            <span>
              {DRAFT_KIND_LABELS[output.kind]} {versionLabel(output.version)}
            </span>
            {output.isFinal ? <Badge tone="success">최종본</Badge> : null}
          </div>
          <p className="text-sm text-muted">
            {confirmedDateLabel(output.createdAt)} 확정 · <span className="break-anywhere">{authorLabel(output.createdBy, members)}</span>
          </p>
        </header>
        <OutputContent output={output} slideHeadingAs="h2" />
      </article>
    </Card>
  );
}
