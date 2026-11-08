// 실시간 구독 도우미. Firestore 리스너를 열고, 해제 함수를 돌려준다.
//
// 오프라인 처리:
// 인터넷이 끊긴 채로 열면 Firestore는 기기 안 저장본(캐시) 기준으로 "문서 없음"·"빈 목록"을 먼저 보낸다.
// 이것을 진짜 "없음"으로 믿으면 초대된 팀원에게 "초대되지 않은 계정" 화면이 뜨는 식으로 잘못 안내하게 된다.
// 그래서 첫 데이터를 넘기기 전에는 캐시에서 온 "없음"을 확정하지 않고 기다린다.
// (첫 데이터를 넘긴 뒤에는 그대로 넘긴다. 오프라인에서 마지막 항목을 지운 결과처럼 진짜 "없음"일 수 있다.) 잠시 뒤에도 서버 확인이 없으면
// "인터넷 연결을 확인해 주세요" 오류를 보내고, 연결이 돌아와 서버 응답이 오면 onData로 바로 고쳐진다.

import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
  type SnapshotMetadata,
} from "firebase/firestore";
import { AppError } from "@/lib/domain/errors";
import type { ErrorHandler, Unsubscribe } from "./types";

/** 캐시에서 온 "없음"을 받은 뒤 이 시간 안에 서버 응답이 없으면 오프라인 안내를 보낸다 */
export const OFFLINE_NOTICE_DELAY_MS = 3000;

export const OFFLINE_MESSAGE =
  "인터넷에 연결되어 있지 않아 최신 내용을 확인하지 못했습니다. 와이파이나 데이터 연결을 확인해 주세요. 연결되면 자동으로 다시 불러옵니다.";

// 캐시에서 온 "없음"이 들어왔을 때, 서버 응답이 늦으면 오프라인 안내를 한 번 보낸다.
function createOfflineNotice(onError: ErrorHandler) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    /** 캐시에서 온 "없음"을 받았을 때 */
    waitForServer() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        onError(new AppError("offline", OFFLINE_MESSAGE));
      }, OFFLINE_NOTICE_DELAY_MS);
    },
    /** 믿을 수 있는 데이터를 받았을 때, 또는 구독을 끊을 때 */
    cancel,
  };
}

/** 캐시에서 온 "없음"인지: 서버 확인 전이라 진짜 없는지 알 수 없다 */
function isUnconfirmedEmpty(metadata: SnapshotMetadata, isEmpty: boolean): boolean {
  return metadata.fromCache && isEmpty;
}

/** 목록 구독. 다른 사람이 바꾼 내용도 새로고침 없이 onData로 다시 들어온다. */
export function listenQuery<T>(
  query: () => Query<DocumentData>,
  parse: (snapshot: QueryDocumentSnapshot<DocumentData>) => T,
  onData: (items: T[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const offline = createOfflineNotice(onError);
  let delivered = false;
  try {
    // includeMetadataChanges: 캐시 → 서버 확인으로 바뀌기만 한 경우에도 알림을 받는다
    const unsubscribe = onSnapshot(
      query(),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!delivered && isUnconfirmedEmpty(snapshot.metadata, snapshot.empty)) {
          offline.waitForServer();
          return;
        }
        offline.cancel();
        delivered = true;
        onData(snapshot.docs.map(parse));
      },
      (error) => {
        offline.cancel();
        onError(error);
      },
    );
    return () => {
      offline.cancel();
      unsubscribe();
    };
  } catch (error) {
    // Firebase 설정이 없거나 로그인 전에 부른 경우
    onError(error);
    return () => {};
  }
}

/** 문서 하나 구독. 문서가 없으면 onData(null) (서버가 확인한 "없음"일 때만) */
export function listenDoc<T>(
  ref: () => DocumentReference<DocumentData>,
  parse: (snapshot: DocumentSnapshot<DocumentData>) => T,
  onData: (item: T | null) => void,
  onError: ErrorHandler,
): Unsubscribe {
  const offline = createOfflineNotice(onError);
  let delivered = false;
  try {
    const unsubscribe = onSnapshot(
      ref(),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!delivered && isUnconfirmedEmpty(snapshot.metadata, !snapshot.exists())) {
          offline.waitForServer();
          return;
        }
        offline.cancel();
        delivered = true;
        onData(snapshot.exists() ? parse(snapshot) : null);
      },
      (error) => {
        offline.cancel();
        onError(error);
      },
    );
    return () => {
      offline.cancel();
      unsubscribe();
    };
  } catch (error) {
    onError(error);
    return () => {};
  }
}
