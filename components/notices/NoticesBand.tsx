"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Section";
import { NoticeList } from "./NoticeList";
import { useNotices } from "./NoticesProvider";

/** 처음에 보여 줄 알림 수. 나머지는 "더 보기"로 편다 */
const PREVIEW_COUNT = 5;

/** 홈 위쪽의 "확인할 알림" 띠. 알림이 없으면 아무것도 그리지 않는다 */
export function NoticesBand() {
  const { active, notices } = useNotices();
  const headingId = useId();
  const [expanded, setExpanded] = useState(false);

  if (!active || notices.length === 0) return null;

  const visible = expanded ? notices : notices.slice(0, PREVIEW_COUNT);
  const hiddenCount = notices.length - visible.length;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-tile border border-warning/25 bg-warning/5 p-4 md:p-5"
    >
      <SectionHeading
        as="h2"
        id={headingId}
        meta={`${notices.length}건`}
        description="내일 내가 맡은 강의와 입금 예정일이 지난 강사료입니다. 누르면 해당 화면으로 갑니다."
      >
        확인할 알림
      </SectionHeading>
      <NoticeList notices={visible} />
      {hiddenCount > 0 || expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "접기" : `${hiddenCount}건 더 보기`}
        </Button>
      ) : null}
    </section>
  );
}
