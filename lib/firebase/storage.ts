// Firebase Storage(파일 저장소) 연결. 카드 첨부 파일에만 쓴다.
// client.ts와 따로 둔 까닭: 파일을 다루지 않는 화면(홈, 캘린더 등)이 Storage 코드를 내려받지 않게 한다.

import { getStorage, type FirebaseStorage } from "firebase/storage";
import { AppError } from "@/lib/domain/errors";
import { getFirebaseApp } from "./client";

let storage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage {
  if (storage) return storage;
  const app = getFirebaseApp();
  if (!app.options.storageBucket) {
    // .env.local(로컬) 또는 Vercel 환경 변수에 NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET이 비어 있다.
    throw new AppError(
      "storage-not-configured",
      "파일 저장소 설정값이 비어 있어 파일을 올리거나 열 수 없습니다. 관리자에게 배포 설정(파일 저장소 주소)을 확인해 달라고 알려 주세요.",
    );
  }
  storage = getStorage(app);
  return storage;
}
