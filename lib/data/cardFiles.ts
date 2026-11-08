// 카드 첨부 파일 읽기·쓰기. 파일 자체는 Storage에, 목록 정보(이름·크기·위치)는 Firestore cardFiles에 둔다.
//
// 올리기는 두 단계다: ① Storage에 파일 올리기 → ② Firestore에 목록 정보 남기기.
// ②만 실패했을 때 큰 파일을 처음부터 다시 올리지 않도록 단계를 나눠 두었다 (화면의 useFileUploads가 차례로 부른다).
// ①은 시도할 때마다 새 파일 id를 쓴다. 같은 자리에 덮어쓰기는 규칙이 막기 때문이다.
//
// 지우기는 휴지통 없이 바로 지운다 (지운 파일이 용량을 계속 차지하지 않게). 순서는 Storage 파일 → 목록 정보.
// 거꾸로 하면 목록 정보만 지워지고 실패했을 때 화면에 안 보이는 파일이 남는다.

import { deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/storage";
import { createStallTimer, READ_TIMEOUT_MS, withTimeout, WRITE_TIMEOUT_MS } from "@/lib/domain/async";
import {
  CARD_FILE_STALL_MS,
  cardFilePath,
  checkCardFile,
  contentDispositionFor,
  uploadPercent,
} from "@/lib/domain/cardFiles";
import { AppError, errorCode } from "@/lib/domain/errors";
import { createId, isSafeId } from "@/lib/domain/ids";
import { courseChildCol, courseChildDoc } from "./refs";
import { toCardFile } from "./convert";
import { listenQuery } from "./listen";
import { requireActorEmail, requireActorUid, runWrite } from "./write";
import type { CardFile, ErrorHandler, Unsubscribe } from "./types";

const STALLED_MESSAGE =
  "30초 동안 파일이 올라가지 않아 멈췄습니다. 인터넷 연결을 확인한 뒤 '다시 올리기'를 눌러 주세요.";
const CANCELED_MESSAGE = "파일 올리기를 멈췄습니다. 다시 올리려면 '다시 올리기'를 눌러 주세요.";
const MISSING_CARD_MESSAGE = "카드를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.";

/** 과정의 첨부 파일 목록 전체 구독. 카드별로는 groupFilesByCard(files)로 묶는다. */
export function subscribeCardFiles(
  courseId: string,
  onData: (files: CardFile[]) => void,
  onError: ErrorHandler,
): Unsubscribe {
  return listenQuery(
    () => courseChildCol(courseId, "cardFiles"),
    (snapshot) => toCardFile(courseId, snapshot),
    onData,
    onError,
  );
}

/** ①단계 결과: Storage에 올라간 파일 */
export interface UploadedCardFile {
  fileId: string;
  name: string;
  size: number;
  contentType: string;
  storagePath: string;
}

export interface UploadOptions {
  /** 진행률 0~100 */
  onProgress?: (percent: number) => void;
  /** abort()하면 올리기를 멈춘다 */
  signal?: AbortSignal;
}

/**
 * ① 파일을 Storage에 올린다. 위치에 올린 사람 uid와 카드 id가 들어간다 (서버 함수가 교안 자동 이동에 쓴다).
 * 30초 동안 진행이 없으면 멈추고 AppError("upload-stalled"), signal로 멈추면 AppError("upload-canceled").
 */
export async function uploadCardFileObject(
  courseId: string,
  cardId: string,
  file: File,
  options: UploadOptions = {},
): Promise<UploadedCardFile> {
  const check = checkCardFile(file);
  if (!check.ok) throw new AppError("invalid-input", check.message);
  if (!isSafeId(courseId) || !isSafeId(cardId)) throw new AppError("invalid-input", MISSING_CARD_MESSAGE);
  // 로그인이 풀렸으면 올리기 전에 알린다 (큰 파일을 다 올린 뒤 실패하지 않게)
  requireActorEmail();
  const uid = requireActorUid();

  const fileId = createId();
  const storagePath = cardFilePath(uid, courseId, cardId, fileId, check.value.name);
  const task = uploadBytesResumable(ref(getFirebaseStorage(), storagePath), file, {
    contentType: check.value.contentType,
    contentDisposition: contentDispositionFor(check.value.name),
  });

  return new Promise<UploadedCardFile>((resolve, reject) => {
    const { signal, onProgress } = options;
    let stalled = false;
    const stall = createStallTimer(CARD_FILE_STALL_MS, () => {
      stalled = true;
      task.cancel();
    });
    const handleAbort = () => task.cancel();
    signal?.addEventListener("abort", handleAbort, { once: true });

    // 끝나면(성공·실패 모두) 타이머·리스너를 치운다
    let stopListening: (() => void) | null = null;
    function cleanUp() {
      stall.stop();
      signal?.removeEventListener("abort", handleAbort);
      stopListening?.();
    }

    // 콜백을 함께 넘기면 on()은 해제 함수를 돌려준다 (타입은 두 경우를 합쳐 적혀 있다)
    stopListening = task.on(
      "state_changed",
      (snapshot) => {
        stall.touch();
        onProgress?.(uploadPercent(snapshot.bytesTransferred, snapshot.totalBytes));
      },
      (error) => {
        cleanUp();
        if (stalled) reject(new AppError("upload-stalled", STALLED_MESSAGE));
        else if (errorCode(error) === "storage/canceled") reject(new AppError("upload-canceled", CANCELED_MESSAGE));
        else reject(error);
      },
      () => {
        cleanUp();
        resolve({ fileId, name: check.value.name, size: file.size, contentType: check.value.contentType, storagePath });
      },
    ) as () => void;

    if (signal?.aborted) task.cancel();
  });
}

/** ② 목록 정보를 Firestore에 남긴다. 같은 파일로 다시 불러도 한 번만 저장된다. */
export async function saveCardFileRecord(
  courseId: string,
  cardId: string,
  uploaded: UploadedCardFile,
): Promise<void> {
  if (!isSafeId(cardId)) throw new AppError("invalid-input", MISSING_CARD_MESSAGE);
  const actor = requireActorEmail();
  await runWrite(
    () =>
      setDoc(courseChildDoc(courseId, "cardFiles", uploaded.fileId), {
        cardId,
        name: uploaded.name,
        size: uploaded.size,
        contentType: uploaded.contentType,
        storagePath: uploaded.storagePath,
        createdBy: actor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      }),
    `cardFile:create:${courseId}:${uploaded.fileId}`,
  );
}

/**
 * ①만 되고 ②를 그만둔 파일을 Storage에서 치운다.
 * 실패해도 알리지 않는다: 목록 정보가 없는 파일이라 화면에 나타나지 않고, 사용자가 할 수 있는 일도 없다.
 */
export async function discardUploadedCardFile(uploaded: UploadedCardFile): Promise<void> {
  try {
    await withTimeout(deleteObject(ref(getFirebaseStorage(), uploaded.storagePath)), WRITE_TIMEOUT_MS);
  } catch {
    // 남은 파일은 용량만 조금 차지한다
  }
}

/** 첨부 파일 지우기 (바로 삭제, 되살리기 없음). Storage 파일이 이미 없으면 목록 정보만 지운다. */
export async function deleteCardFile(courseId: string, file: CardFile): Promise<void> {
  try {
    await withTimeout(deleteObject(ref(getFirebaseStorage(), file.storagePath)), WRITE_TIMEOUT_MS);
  } catch (error) {
    if (errorCode(error) !== "storage/object-not-found") throw error;
  }
  await runWrite(() => deleteDoc(courseChildDoc(courseId, "cardFiles", file.id)));
}

/**
 * 파일을 여는 주소. 받는 순간 보안 규칙이 팀원인지 확인한다.
 * 주의: 받은 주소에는 열쇠(토큰)가 들어 있어, 주소를 복사해 넘기면 받은 사람도 열 수 있다.
 */
export function getCardFileUrl(storagePath: string): Promise<string> {
  return withTimeout(getDownloadURL(ref(getFirebaseStorage(), storagePath)), READ_TIMEOUT_MS);
}
