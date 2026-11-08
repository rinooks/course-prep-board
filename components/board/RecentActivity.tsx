"use client";

// 과정 보드 위쪽의 "최근 활동": 이 과정의 최근 기록 5개 (새것부터, 실시간).
// 기록은 서버 함수가 남긴다: 내가 만든 '고객사 요청 확인'·'교안' 카드에 교안(PPT·PPTX·PDF)을 붙이면
// 그 카드를 '리허설' 단계로 옮기고 여기에 한 줄을 남긴다 (PRD F9).
// 구독은 이 구역이 직접 연다 (useCourseBoardData와 따로).

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { InlineLoading } from "@/components/ui/Spinner";
import { subscribeCourseActivity } from "@/lib/data/activity";
import type { Activity } from "@/lib/data/types";
import { formatActivityTime } from "@/lib/domain/activity";
import { useLiveSubscription } from "./useLiveSubscription";
import { useNow } from "./useNow";

const NO_ACTIVITY: Activity[] = [];

interface RecentActivityProps {
  courseId: string;
}

export function RecentActivity({ courseId }: RecentActivityProps) {
  const activity = useLiveSubscription(
    `activity:${courseId}`,
    (onData, onError) => subscribeCourseActivity(courseId, onData, onError),
    NO_ACTIVITY,
  );
  const now = useNow();

  return (
    <Section
      tile
      title="최근 활동"
      description="내가 만든 '고객사 요청 확인'·'교안' 카드에 교안(PPT·PDF)을 붙이면, 몇 초 뒤 그 카드가 '리허설' 단계로 옮겨지고 여기에 남습니다."
    >
      {activity.error ? (
        <Alert
          tone="warning"
          title="최근 활동을 불러오지 못했습니다"
          action={
            <Button variant="outline" size="sm" onClick={activity.retry}>
              다시 시도
            </Button>
          }
        >
          {activity.error}
        </Alert>
      ) : null}

      {!activity.loaded && !activity.error ? <InlineLoading label="최근 활동을 불러오는 중입니다…" /> : null}

      {activity.loaded && activity.value.length === 0 ? (
        <p className="text-sm text-muted">아직 기록이 없습니다.</p>
      ) : null}

      {activity.value.length > 0 ? (
        <ol className="flex flex-col divide-y divide-line">
          {activity.value.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">{item.message}</p>
              <time
                className="shrink-0 whitespace-nowrap text-xs text-muted"
                dateTime={item.createdAt !== null ? new Date(item.createdAt).toISOString() : undefined}
              >
                {formatActivityTime(item.createdAt, now)}
              </time>
            </li>
          ))}
        </ol>
      ) : null}
    </Section>
  );
}
