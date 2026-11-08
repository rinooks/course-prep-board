import "server-only";

// 서버 전용 Firebase 연결 (Admin SDK). 보안 규칙을 거치지 않고 모든 데이터를 읽고 쓸 수 있으므로
// 브라우저 코드에서 절대 부르지 않는다 ("server-only"가 실수로 가져오는 것을 빌드에서 막는다).
// 키는 환경 변수 FIREBASE_SERVICE_ACCOUNT에서만 읽는다. 처음 쓸 때 한 번만 만든다.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { describeForLog, ServerSetupError } from "./errors";
import { parseServiceAccount } from "./serviceAccount";

/** 이름을 붙여 만들어, 혹시 다른 코드가 기본 앱을 만들어도 겹치지 않게 한다 */
const ADMIN_APP_NAME = "lecture-prep-board-server";

export function getAdminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  try {
    return initializeApp(
      { credential: cert(account), projectId: account.projectId },
      ADMIN_APP_NAME,
    );
  } catch (error) {
    console.error("[firebase-admin] 초기화 실패:", describeForLog(error));
    throw new ServerSetupError(
      "service-account-invalid",
      "서비스 계정 키로 Firebase에 연결하지 못했습니다. FIREBASE_SERVICE_ACCOUNT에 내려받은 키 JSON을 그대로 넣었는지 확인해 주세요.",
    );
  }
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

// firebase-admin/auth는 쓰지 않는다: 그 안의 jwks-rsa가 Vercel 서버에서 불러오기 오류(ERR_REQUIRE_ESM)를 낸다.
// 로그인 확인은 lib/server/idToken.ts가 구글 로그인 서버에 직접 묻는다.
