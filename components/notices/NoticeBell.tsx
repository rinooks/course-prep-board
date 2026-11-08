"use client";

// 머리글의 종 버튼 + 알림 패널.
// - 버튼: 44px, 화면 낭독기는 "알림 N개"로 읽는다. 알림 수는 빨간 배지로 보인다.
// - 패널: 열리면 패널로 포커스가 옮겨 가고, Esc를 누르면 닫히며 종 버튼으로 포커스가 돌아온다.
//   바깥을 누르거나 Tab으로 패널 밖으로 나가도 닫힌다.

import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { BellIcon } from "@/components/ui/icons";
import { SectionHeading } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { noticeBadgeText, noticeCountLabel } from "@/lib/domain/notices";
import { NoticeList } from "./NoticeList";
import { useNotices } from "./NoticesProvider";

export function NoticeBell() {
  const { active, notices, loading, error, retry } = useNotices();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const count = notices.length;

  // 열려 있는 동안만: 패널로 포커스 이동, 바깥 누르기·Esc로 닫기. 닫히면 리스너를 모두 치운다
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    const focusBell = () => wrapperRef.current?.querySelector<HTMLButtonElement>("button[data-notice-bell]")?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
      focusBell();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        // 키보드로 패널 밖으로 나가면 닫는다 (마우스로 패널 빈 곳을 누른 경우 relatedTarget은 null이라 그대로 둔다)
        const next = event.relatedTarget as Node | null;
        if (open && next && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <IconButton
        data-notice-bell=""
        label={noticeCountLabel(count)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        className="relative"
        onClick={() => setOpen((value) => !value)}
        icon={
          <>
            <BellIcon />
            {count > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-button bg-danger px-1 text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {noticeBadgeText(count)}
              </span>
            ) : null}
          </>
        }
      />

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label="알림"
          tabIndex={-1}
          className="absolute top-full right-0 z-40 mt-2 flex max-h-[min(32rem,75dvh)] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-tile border border-line bg-white p-4 shadow-lg animate-pop-in motion-reduce:animate-none focus:outline-none"
        >
          <SectionHeading as="h3" meta={count > 0 ? `${count}건` : null}>
            알림
          </SectionHeading>

          {error ? (
            <Alert
              tone="error"
              title="알림을 모두 불러오지 못했습니다"
              action={
                <Button variant="outline" size="sm" onClick={retry}>
                  다시 시도
                </Button>
              }
            >
              {error}
            </Alert>
          ) : null}

          {count > 0 ? <NoticeList notices={notices} onNavigate={() => setOpen(false)} /> : null}

          {loading ? (
            <InlineLoading label="알림을 불러오는 중입니다…" />
          ) : count === 0 && !error ? (
            <p className="text-sm leading-relaxed text-muted">
              새 알림이 없습니다. 내가 맡은 과정의 강의 전날과 입금 예정일이 지난 강사료가 있으면 여기에 보입니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
