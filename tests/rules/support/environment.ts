// 규칙 테스트 공용 준비: 에뮬레이터 연결, 사람별 Firestore·Storage 열기, 테스트마다 기본 데이터 다시 심기.
// 테스트 파일 맨 위에서 setupRulesEnvironment()를 한 번 부르면 beforeAll·afterAll·beforeEach가 등록된다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TokenOptions,
} from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import { deleteObject, listAll, ref, type FirebaseStorage, type StorageReference } from "firebase/storage";
import {
  ADMIN,
  BOOTSTRAP_EMAIL,
  CARD_ID,
  COURSE_ID,
  ITEM_ID,
  PROJECT_ID,
  SECOND_CARD_ID,
  SECOND_ITEM_ID,
  SESSION_ID,
  TEACHER,
  TEACHER2,
  TRASHED_CARD_ID,
  TRASHED_COURSE_ID,
  uidOf,
} from "./constants";
import { newCard, newChecklistItem, newCourse, newSession, seededMember } from "./documents";

// 기본은 실제 배포에 쓰는 규칙 파일 그대로.
// 규칙 수정안을 실제 파일을 바꾸지 않고 시험할 때만 FIRESTORE_RULES_UNDER_TEST=사본경로 로 바꿔 끼운다.
const RULES_PATH =
  process.env.FIRESTORE_RULES_UNDER_TEST ?? fileURLToPath(new URL("../../../firestore.rules", import.meta.url));
const STORAGE_RULES_PATH = fileURLToPath(new URL("../../../storage.rules", import.meta.url));

export interface RulesHarness {
  /** 구글로 로그인하고 이메일 인증이 끝난 사람 (verified: false면 미인증) */
  as(email: string, options?: { verified?: boolean }): Firestore;
  /** 토큰 내용을 직접 정한 사람 (이메일이 없거나 email_verified가 없는 토큰 등) */
  withToken(uid: string, token: TokenOptions): Firestore;
  /** 로그인하지 않은 사람 */
  anonymous(): Firestore;
  /** 규칙을 끈 상태로 데이터를 넣거나 읽는다 (준비·확인용) */
  privileged<T>(work: (db: Firestore) => Promise<T>): Promise<T>;
  /** 같은 사람의 파일 저장소(Storage). Storage 규칙은 Firestore의 팀원·과정 문서를 함께 본다 */
  storageAs(email: string, options?: { verified?: boolean }): FirebaseStorage;
  /** 로그인하지 않은 사람의 Storage */
  anonymousStorage(): FirebaseStorage;
  /** 규칙을 끈 상태로 파일을 넣어 둔다 (준비용) */
  privilegedStorage<T>(work: (storage: FirebaseStorage) => Promise<T>): Promise<T>;
  /** Storage의 파일을 모두 지운다 (Storage 테스트의 beforeEach에서 부른다) */
  clearStorage(): Promise<void>;
}

export function setupRulesEnvironment(): RulesHarness {
  let environment: RulesTestEnvironment | undefined;

  function current(): RulesTestEnvironment {
    if (!environment) {
      throw new Error("규칙 테스트 환경이 아직 준비되지 않았습니다. npm run test:rules로 실행해 주세요.");
    }
    return environment;
  }

  function contextFirestore(context: { firestore(): unknown }): Firestore {
    // rules-unit-testing은 compat 인스턴스를 돌려주지만, 모듈식 함수(doc, setDoc…)에 그대로 넘길 수 있다.
    return context.firestore() as Firestore;
  }

  function contextStorage(context: { storage(): unknown }): FirebaseStorage {
    // Firestore와 마찬가지로 compat 인스턴스지만 모듈식 함수(ref, uploadBytes…)에 그대로 넘길 수 있다.
    return context.storage() as FirebaseStorage;
  }

  function googleToken(email: string, verified: boolean): TokenOptions {
    return {
      email,
      email_verified: verified,
      firebase: { sign_in_provider: "google.com" },
    };
  }

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: readFileSync(RULES_PATH, "utf8") },
      storage: { rules: readFileSync(STORAGE_RULES_PATH, "utf8") },
    });
  });

  afterAll(async () => {
    await environment?.cleanup();
  });

  beforeEach(async () => {
    const env = current();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      await seedBaseline(contextFirestore(context));
    });
  });

  return {
    as(email, options = {}) {
      const token = googleToken(email, options.verified ?? true);
      return contextFirestore(current().authenticatedContext(uidOf(email), token));
    },
    withToken(uid, token) {
      return contextFirestore(current().authenticatedContext(uid, token));
    },
    anonymous() {
      return contextFirestore(current().unauthenticatedContext());
    },
    async privileged<T>(work: (db: Firestore) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await current().withSecurityRulesDisabled(async (context) => {
        result = await work(contextFirestore(context));
      });
      return result as T;
    },
    storageAs(email, options = {}) {
      const token = googleToken(email, options.verified ?? true);
      return contextStorage(current().authenticatedContext(uidOf(email), token));
    },
    anonymousStorage() {
      return contextStorage(current().unauthenticatedContext());
    },
    async privilegedStorage<T>(work: (storage: FirebaseStorage) => Promise<T>): Promise<T> {
      let result: T | undefined;
      await current().withSecurityRulesDisabled(async (context) => {
        result = await work(contextStorage(context));
      });
      return result as T;
    },
    async clearStorage() {
      // rules-unit-testing의 clearStorage()는 맨 위 폴더의 파일만 지운다.
      // 첨부 파일은 courses/…/cardFiles/… 폴더 안에 있으므로 폴더를 따라 들어가며 직접 지운다.
      await current().withSecurityRulesDisabled(async (context) => {
        await deleteFolder(ref(contextStorage(context)));
      });
    },
  };
}

/** 폴더 안의 파일을 하위 폴더까지 모두 지운다 */
async function deleteFolder(folder: StorageReference): Promise<void> {
  const { items, prefixes } = await listAll(folder);
  await Promise.all(items.map((item) => deleteObject(item)));
  await Promise.all(prefixes.map((prefix) => deleteFolder(prefix)));
}

/**
 * 기본 데이터
 * - 팀원: ADMIN(관리자), TEACHER·TEACHER2(강사). 첫 관리자 문서는 일부러 없다(첫 로그인 전 상태).
 * - 진행 중 과정 COURSE_ID: 카드 2장(+휴지통 카드 1장), CARD_ID의 체크리스트 2개, 회차 1개
 * - 휴지통 과정 TRASHED_COURSE_ID: ADMIN이 휴지통에 넣은 과정과 카드 1장
 */
async function seedBaseline(db: Firestore): Promise<void> {
  const batch = writeBatch(db);

  batch.set(doc(db, "members", ADMIN), seededMember(ADMIN, "admin"));
  batch.set(doc(db, "members", TEACHER), seededMember(TEACHER, "instructor"));
  batch.set(doc(db, "members", TEACHER2), seededMember(TEACHER2, "instructor"));

  batch.set(doc(db, "courses", COURSE_ID), newCourse(TEACHER));
  batch.set(doc(db, "courses", COURSE_ID, "cards", CARD_ID), newCard(TEACHER, { order: 1024 }));
  batch.set(
    doc(db, "courses", COURSE_ID, "cards", SECOND_CARD_ID),
    newCard(TEACHER, { title: "교육 목표 정리", order: 2048 }),
  );
  batch.set(
    doc(db, "courses", COURSE_ID, "cards", TRASHED_CARD_ID),
    newCard(TEACHER, { title: "지운 카드", order: 3072, deletedAt: serverTimestamp(), deletedBy: TEACHER }),
  );
  batch.set(
    doc(db, "courses", COURSE_ID, "checklistItems", ITEM_ID),
    newChecklistItem(TEACHER, CARD_ID, { order: 1024 }),
  );
  batch.set(
    doc(db, "courses", COURSE_ID, "checklistItems", SECOND_ITEM_ID),
    newChecklistItem(TEACHER, CARD_ID, { text: "교육 인원 확인", order: 2048 }),
  );
  batch.set(doc(db, "courses", COURSE_ID, "sessions", SESSION_ID), newSession(TEACHER));

  batch.set(
    doc(db, "courses", TRASHED_COURSE_ID),
    newCourse(TEACHER, { title: "지운 과정", deletedAt: serverTimestamp(), deletedBy: ADMIN }),
  );
  batch.set(doc(db, "courses", TRASHED_COURSE_ID, "cards", CARD_ID), newCard(TEACHER));

  await batch.commit();
}

/** 첫 관리자가 이미 한 번 로그인해 자기 문서가 있는 상태로 만든다 */
export async function seedBootstrapMember(rules: RulesHarness): Promise<void> {
  await rules.privileged(async (db) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "members", BOOTSTRAP_EMAIL), seededMember(BOOTSTRAP_EMAIL, "admin"));
    await batch.commit();
  });
}
