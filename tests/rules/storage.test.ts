// 요구사항: 카드 첨부 파일 저장소 (storage.rules, 위치 materials/{올린 사람 uid}/{과정}/{카드}/{파일 id}/{이름})
// - 초대된 팀원만 올리고·읽고·지운다. 팀원 여부는 Firestore members 문서로 확인한다 (교차 서비스 규칙)
// - 경로의 uid는 올린 본인이어야 한다 (서버 함수가 경로의 uid를 올린 사람으로 믿는다)
// - 예전 위치(courses/{과정}/cardFiles/…)의 파일은 열고 지울 수만 있다
// - 진행 중인 과정에만 올린다. 휴지통 과정·없는 과정에는 관리자도 못 올린다
// - 허용 형식만, 1바이트~100MB, 이름 200자까지. 이미 있는 파일은 덮어쓸 수 없다
// - 규칙에 없는 위치는 전부 막힌다

import { beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteObject, getMetadata, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { CARD_FILE_TYPES } from "@/lib/domain/cardFiles";
import {
  ADMIN,
  BOOTSTRAP_EMAIL,
  CARD_ID,
  COURSE_ID,
  STRANGER,
  TEACHER,
  TEACHER2,
  TRASHED_COURSE_ID,
  uidOf,
} from "./support/constants";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

beforeEach(async () => {
  await rules.clearStorage();
});

const MAX_BYTES = 100 * 1024 * 1024;
const PDF = { contentType: "application/pdf" };

/** 올리는 사람(uploader)의 uid가 들어간 위치 */
function filePath(fileId = "file-1", name = "교안.pdf", courseId = COURSE_ID, uploader = TEACHER2): string {
  return `materials/${uidOf(uploader)}/${courseId}/${CARD_ID}/${fileId}/${name}`;
}

/** 2026-10-25 이전 첨부 파일 위치 */
function legacyPath(fileId = "file-old", name = "예전 교안.pdf"): string {
  return `courses/${COURSE_ID}/cardFiles/${fileId}/${name}`;
}

function bytes(size = 1024): Uint8Array {
  return new Uint8Array(size).fill(7);
}

function upload(storage: FirebaseStorage, path = filePath(), data = bytes(), metadata: { contentType?: string } = PDF) {
  return uploadBytes(ref(storage, path), data, metadata);
}

/** 미리 넣어 두는 파일: TEACHER가 올린 것 (다른 사람이 읽고 지우는지 검사용) */
const SEEDED = filePath("file-seeded", "교안.pdf", COURSE_ID, TEACHER);

/** 규칙을 끈 상태로 파일을 하나 넣어 둔다 */
async function seedObject(path = SEEDED): Promise<void> {
  await rules.privilegedStorage((storage) => upload(storage, path));
}

describe("팀원", () => {
  it("강사는 진행 중인 과정에 파일을 올린다", async () => {
    await assertSucceeds(upload(rules.storageAs(TEACHER2)));
  });

  it("첫 관리자는 팀원 문서가 생기기 전에도 올린다", async () => {
    await assertSucceeds(
      upload(rules.storageAs(BOOTSTRAP_EMAIL), filePath("file-1", "교안.pdf", COURSE_ID, BOOTSTRAP_EMAIL)),
    );
  });

  it("앱이 보내는 허용 형식은 모두 통과한다", async () => {
    const storage = rules.storageAs(TEACHER2);
    for (const [extension, contentType] of Object.entries(CARD_FILE_TYPES)) {
      await assertSucceeds(upload(storage, filePath(`file-${extension}`, `자료.${extension}`), bytes(), { contentType }));
    }
  });

  it("끝값: 이름 200자는 통과한다", async () => {
    const name = `${"가".repeat(196)}.pdf`;
    await assertSucceeds(upload(rules.storageAs(TEACHER2), filePath("file-long", name)));
  });

  it("다른 팀원이 올린 파일을 읽고 지운다", async () => {
    await seedObject();
    const storage = rules.storageAs(TEACHER2);
    await assertSucceeds(getMetadata(ref(storage, SEEDED)));
    await assertSucceeds(deleteObject(ref(storage, SEEDED)));
  });
});

describe("사람 때문에 막히는 경우", () => {
  it("로그인하지 않으면 올리기·읽기·지우기가 막힌다", async () => {
    await seedObject();
    const storage = rules.anonymousStorage();
    await assertFails(upload(storage));
    await assertFails(getMetadata(ref(storage, SEEDED)));
    await assertFails(deleteObject(ref(storage, SEEDED)));
  });

  it("이메일 인증이 안 된 계정은 팀원이어도 막힌다", async () => {
    await seedObject();
    const storage = rules.storageAs(TEACHER, { verified: false });
    await assertFails(upload(storage, filePath("file-1", "교안.pdf", COURSE_ID, TEACHER)));
    await assertFails(getMetadata(ref(storage, SEEDED)));
  });

  it("초대받지 않은 사람은 올리기·읽기·지우기가 막힌다", async () => {
    await seedObject();
    const storage = rules.storageAs(STRANGER);
    await assertFails(upload(storage, filePath("file-1", "교안.pdf", COURSE_ID, STRANGER)));
    await assertFails(getMetadata(ref(storage, SEEDED)));
    await assertFails(deleteObject(ref(storage, SEEDED)));
  });
});

describe("과정·파일 때문에 막히는 경우", () => {
  it("휴지통 과정에는 관리자도 못 올린다", async () => {
    await assertFails(upload(rules.storageAs(ADMIN), filePath("file-1", "교안.pdf", TRASHED_COURSE_ID, ADMIN)));
  });

  it("경로의 uid가 본인이 아니면 못 올린다 (다른 사람이 올린 것처럼 꾸미지 못하게)", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), filePath("file-1", "교안.pdf", COURSE_ID, TEACHER)));
  });

  it("예전 위치에는 새로 올릴 수 없지만, 있던 파일은 열고 지운다", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), legacyPath("file-new")));
    await seedObject(legacyPath());
    const storage = rules.storageAs(TEACHER2);
    await assertSucceeds(getMetadata(ref(storage, legacyPath())));
    await assertSucceeds(deleteObject(ref(storage, legacyPath())));
  });

  it("예전 위치의 파일도 팀원이 아니면 열 수 없다", async () => {
    await seedObject(legacyPath());
    await assertFails(getMetadata(ref(rules.storageAs(STRANGER), legacyPath())));
  });

  it("없는 과정에는 못 올린다", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), filePath("file-1", "교안.pdf", "no-such-course")));
  });

  it("허용하지 않는 형식은 막힌다 (html·svg·실행 파일·형식 없음)", async () => {
    const storage = rules.storageAs(TEACHER2);
    for (const contentType of ["text/html", "image/svg+xml", "application/x-msdownload", "application/octet-stream"]) {
      await assertFails(upload(storage, filePath("file-bad", "자료.pdf"), bytes(), { contentType }));
    }
    await assertFails(upload(storage, filePath("file-none", "자료.pdf"), bytes(), {}));
  });

  it("빈 파일은 막힌다", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), filePath(), bytes(0)));
  });

  it("100MB를 넘으면 막힌다", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), filePath(), bytes(MAX_BYTES + 1)));
  });

  it("이름이 200자를 넘으면 막힌다", async () => {
    await assertFails(upload(rules.storageAs(TEACHER2), filePath("file-long", `${"가".repeat(200)}.pdf`)));
  });

  it("이미 있는 파일은 덮어쓸 수 없다 (올린 본인도)", async () => {
    await seedObject(filePath());
    await assertFails(upload(rules.storageAs(TEACHER2)));
  });

  it("규칙에 없는 위치나 이상한 id는 막힌다", async () => {
    const storage = rules.storageAs(TEACHER2);
    const me = uidOf(TEACHER2);
    const paths = [
      "files/교안.pdf",
      `materials/${me}/교안.pdf`,
      `materials/${me}/${COURSE_ID}/${CARD_ID}/교안.pdf`,
      `materials/${me}/${COURSE_ID}/${CARD_ID}/file-1/폴더/교안.pdf`,
      `materials/${me}/${COURSE_ID}/${CARD_ID}/bad.id/교안.pdf`,
      `materials/${me}/${COURSE_ID}/bad.card/file-1/교안.pdf`,
    ];
    for (const path of paths) {
      await assertFails(upload(storage, path));
    }
  });
});
