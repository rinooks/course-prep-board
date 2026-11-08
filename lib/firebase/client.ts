// Firebase 연결. 브라우저에서 처음 쓸 때 한 번만 만든다 (서버 빌드·사전 렌더링 중에는 만들지 않는다).
// 설정값이 없어도 빌드는 성공하고, 실제로 쓰려는 순간에만 오류를 낸다.

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { AppError } from "@/lib/domain/errors";

/**
 * 운영 앱 도메인. 구글 팝업 로그인을 앱과 같은 도메인에서 처리하게 해서
 * Safari·Chrome의 서드파티 쿠키 차단 때문에 로그인이 조용히 실패하는 문제를 막는다.
 * next.config.ts의 /__/ 프록시, 구글 OAuth 콘솔, Firebase 승인된 도메인과 세트다.
 * 도메인을 바꾸면 네 곳을 함께 바꾼다.
 */
export const PRODUCTION_AUTH_DOMAIN = "edu-project-beta.vercel.app";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

// NEXT_PUBLIC_ 값은 빌드 때 코드에 그대로 박히므로 반드시 process.env.이름 형태로 하나씩 읽는다.
function readConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/** 필수 설정값(apiKey, projectId, appId, authDomain)이 모두 있는지 */
export function isFirebaseConfigured(): boolean {
  const config = readConfig();
  return Boolean(config.apiKey && config.projectId && config.appId && config.authDomain);
}

function assertBrowser() {
  if (typeof window === "undefined") {
    // 서버에서 부르면 개발 실수다. 클라이언트 컴포넌트의 useEffect·이벤트 안에서만 부른다.
    throw new Error("Firebase 클라이언트는 브라우저에서만 쓸 수 있습니다. useEffect나 이벤트 처리 안에서 부르세요.");
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  assertBrowser();
  if (!isFirebaseConfigured()) {
    // .env.local(로컬) 또는 Vercel 환경 변수에 NEXT_PUBLIC_FIREBASE_* 값이 비어 있다.
    throw new AppError(
      "firebase-not-configured",
      "앱 설정값(Firebase)이 비어 있어 연결할 수 없습니다. 관리자에게 배포 설정을 확인해 달라고 알려 주세요.",
    );
  }
  const config: FirebaseOptions = {
    ...readConfig(),
    // 운영 빌드에서만 앱 자체 도메인을 쓴다. 로컬 개발에는 /__/ 프록시가 없으므로 기본값을 유지한다.
    // 되돌리려면 이 한 줄만 지운다.
    ...(process.env.NODE_ENV === "production" ? { authDomain: PRODUCTION_AUTH_DOMAIN } : {}),
  };
  app = getApps().length > 0 ? getApp() : initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}

export function getDb(): Firestore {
  if (firestore) return firestore;
  const firebaseApp = getFirebaseApp();
  try {
    // undefined 값이 섞여도 저장이 실패하지 않게 한다 (선택 칸을 비운 경우 등).
    firestore = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
  } catch {
    // 개발 중 화면 새로 고침(HMR)으로 이미 만들어진 경우
    firestore = getFirestore(firebaseApp);
  }
  return firestore;
}
