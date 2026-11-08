// 최근 활동(activity) 읽기. 쓰기는 서버 함수(functions/src/onLectureUploaded.ts)만 한다 (규칙이 화면 쓰기를 막는다).

import { limit, orderBy, query, where } from "firebase/firestore";
import { RECENT_ACTIVITY_COUNT } from "@/lib/domain/activity";
import { topCol } from "./refs";
import { toActivity } from "./convert";
import { listenQuery } from "./listen";
import type { Activity, ErrorHandler, Unsubscribe } from "./types";

/** 과정의 최근 활동 5개 구독 (새것부터). firestore.indexes.json의 courseId + createdAt 색인을 쓴다 */
export function subscribeCourseActivity(
  courseId: string,
  onData: (items: Activity[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () =>
      query(
        topCol("activity"),
        where("courseId", "==", courseId),
        orderBy("createdAt", "desc"),
        limit(RECENT_ACTIVITY_COUNT),
      ),
    toActivity,
    onData,
    onError,
  );
}
