"use client";

// 결과물 한 판 카드: 판 번호·최종본 표시·만든 사람·날짜, 최종본 링크, 그리고 할 수 있는 일
// (미리보기, PPT 내려받기, PDF로 저장, 최종본 표시, 휴지통으로).

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { cn, focusRing } from "@/components/ui/cn";
import { DownloadIcon, LinkIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { markOutputFinal, setOutputTrashed } from "@/lib/data/drafts";
import type { Course, Member, Output } from "@/lib/data/types";
import { toUserMessage } from "@/lib/domain/errors";
import { buildPptxModel, pptxFileName } from "@/lib/domain/exportFiles";
import { isHttpUrl } from "@/lib/domain/materials";
import { parseSlides } from "@/lib/domain/slides";
import { downloadSlidesPptx } from "./exportPptx";
import { FinalLinkModal } from "./FinalLinkModal";
import { OutputPreviewModal } from "./OutputPreviewModal";
import { authorLabel, confirmedDateLabel, outputPrintHref, outputTitle, versionLabel } from "./outputLabels";

const NOT_SLIDE_FORMAT =
  "이 판은 슬라이드 형식이 아니어서 PPT로 만들 수 없습니다. 초안 탭에서 '## 슬라이드 제목'과 '- 핵심 메시지' 형식인지 확인하고 다시 확정해 주세요. 내용은 'PDF로 저장'으로 받을 수 있습니다.";

const PPTX_FAILED =
  "PPT 파일을 만들지 못했습니다. 인터넷 연결을 확인하고 페이지를 새로고침한 뒤 다시 눌러 주세요. 계속 안 되면 'PDF로 저장'으로 내용을 먼저 받아 두세요.";

type OpenDialog = "preview" | "link" | "trash" | null;

interface OutputCardProps {
  course: Course;
  output: Output;
  /** 이 과정의 휴지통 밖 결과물 전체 (최종본 표시를 하나만 남기는 데 쓴다) */
  outputs: readonly Output[];
  members: readonly Member[];
}

export function OutputCard({ course, output, outputs, members }: OutputCardProps) {
  const toast = useToast();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [markingFinal, setMarkingFinal] = useState(false);
  const title = outputTitle(output);
  const closeDialog = () => setDialog(null);

  async function handleDownloadPptx() {
    const result = buildPptxModel(parseSlides(output.content), { courseTitle: course.title, client: course.client });
    if (!result.ok) {
      toast.error(NOT_SLIDE_FORMAT);
      return;
    }
    const fileName = pptxFileName(course.title, output.version);
    try {
      await downloadSlidesPptx(result.model, fileName);
      toast.success(`'${fileName}' 파일을 내려받았습니다. 브라우저의 다운로드 목록에서 열어 보세요.`);
    } catch (error) {
      // 원인은 개발자 도구에서 볼 수 있게 남기고, 사용자에게는 다음 할 일만 알린다
      console.error("PPT 만들기 실패", error);
      toast.error(PPTX_FAILED);
    }
  }

  async function handleToggleFinal() {
    const final = !output.isFinal;
    const replaced = final && outputs.some((other) => other.id !== output.id && other.kind === output.kind && other.isFinal);
    setMarkingFinal(true);
    try {
      await markOutputFinal(course.id, output, final, outputs);
      if (!final) toast.success(`${title}의 최종본 표시를 내렸습니다.`);
      else if (replaced) toast.success(`${title}을 최종본으로 표시했습니다. 같은 종류의 다른 판 표시는 내렸습니다.`);
      else toast.success(`${title}을 최종본으로 표시했습니다.`);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setMarkingFinal(false);
    }
  }

  async function handleTrash() {
    await setOutputTrashed(course.id, output.id, true);
    toast.success(`${title}을 휴지통에 넣었습니다. 아래 '휴지통'에서 되살릴 수 있습니다.`);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight text-ink tabular-nums">{versionLabel(output.version)}</h3>
          {output.isFinal ? <Badge tone="success">최종본</Badge> : null}
        </div>
        <p className="text-sm text-muted">
          <span className="break-anywhere">{authorLabel(output.createdBy, members)}</span>
          {" · "}
          {confirmedDateLabel(output.createdAt)} 확정
        </p>
      </div>

      <FinalLinkBox output={output} onEdit={() => setDialog("link")} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setDialog("preview")}>
          미리보기
        </Button>
        {output.kind === "slides" ? (
          <Button variant="outline" size="sm" onClick={handleDownloadPptx} loadingLabel="PPT 파일을 만드는 중">
            <DownloadIcon />
            PPT 내려받기
          </Button>
        ) : null}
        <ButtonLink
          variant="outline"
          size="sm"
          href={outputPrintHref(course.id, output.id)}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
        >
          <DownloadIcon />
          PDF로 저장
          <span className="sr-only">(새 탭에서 인쇄 화면이 열립니다)</span>
        </ButtonLink>
      </div>

      <div className="-mx-1 flex flex-wrap gap-1 border-t border-line pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleFinal}
          loading={markingFinal}
          loadingLabel="저장하는 중"
        >
          {output.isFinal ? "최종본 표시 내리기" : "최종본으로 표시"}
        </Button>
        <Button variant="dangerGhost" size="sm" onClick={() => setDialog("trash")}>
          <TrashIcon />
          휴지통으로
        </Button>
      </div>

      {dialog === "preview" ? <OutputPreviewModal open onClose={closeDialog} output={output} /> : null}
      {dialog === "link" ? <FinalLinkModal courseId={course.id} output={output} onClose={closeDialog} /> : null}
      <ConfirmDialog
        open={dialog === "trash"}
        onClose={closeDialog}
        onConfirm={handleTrash}
        tone="danger"
        title={`${title}을 휴지통에 넣을까요?`}
        description={
          output.isFinal
            ? "최종본 표시도 함께 내려갑니다. 휴지통에서 언제든 되살릴 수 있습니다."
            : "휴지통에서 언제든 되살릴 수 있습니다."
        }
        confirmLabel="휴지통으로"
      />
    </Card>
  );
}

/** 최종본 링크 칸: 링크가 있으면 새 탭으로 여는 링크 + 바꾸기, 없으면 "링크 넣기" */
function FinalLinkBox({ output, onEdit }: { output: Output; onEdit: () => void }) {
  // 보안 규칙이 http(s)만 허용하지만, 혹시 다른 값이 들어 있으면 누를 수 있는 링크로 만들지 않는다
  const link = output.finalUrl && isHttpUrl(output.finalUrl) ? output.finalUrl : null;

  return (
    <Card padding="sm" flat tone="surface" className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-ink">최종본 링크</p>
      {output.finalUrl ? (
        <div className="flex items-start justify-between gap-2">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center gap-2 rounded-button text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary/80",
                focusRing,
              )}
            >
              <LinkIcon className="h-4 w-4 shrink-0" />
              <span className="break-anywhere">{link}</span>
              <span className="sr-only">(새 탭에서 열림)</span>
            </a>
          ) : (
            <p className="min-h-11 py-3 text-sm text-muted break-anywhere">{output.finalUrl}</p>
          )}
          <IconButton label="최종본 링크 바꾸기" icon={<PencilIcon />} onClick={onEdit} className="-my-0.5 -mr-2" />
        </div>
      ) : (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">PowerPoint에서 다듬은 최종본을 드라이브에 올리고 링크를 남겨 두세요.</p>
          <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
            <LinkIcon />
            링크 넣기
          </Button>
        </div>
      )}
    </Card>
  );
}
