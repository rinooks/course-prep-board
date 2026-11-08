// 요구사항: 카드 첨부 파일 목록(courses/{id}/cardFiles/{fileId})
// - 팀원만 읽고 만든다. 휴지통 과정 아래에는 강사가 만들 수 없다 (courseWritable)
// - 저장 위치(storagePath)는 materials/{내 uid}/{과정}/{카드}/{문서 id}/{이름}이어야 한다 (다른 파일을 가리키지 못하게)
// - 붙일 카드가 실제로 있어야 한다. 이름에 /가 들어가면 막는다. 크기는 1바이트~100MB 정수
// - 만든 뒤에는 고칠 수 없다. 지우기는 휴지통 없이 바로 지운다

import { describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { CARD_ID, COURSE_ID, SECOND_CARD_ID, STRANGER, TEACHER, TEACHER2, TRASHED_COURSE_ID, uidOf } from "./support/constants";
import { newCardFile, touch, withoutField } from "./support/documents";
import { setupRulesEnvironment } from "./support/environment";

const rules = setupRulesEnvironment();

const FILE_ID = "file-new";
const MAX_BYTES = 100 * 1024 * 1024;
const MAX_NAME = 200;

function fileRef(db: Firestore, fileId = FILE_ID, courseId = COURSE_ID) {
  return doc(db, "courses", courseId, "cardFiles", fileId);
}

/** 미리 하나 만들어 둔다 (고치기·지우기 검사용) */
async function seedFile(): Promise<void> {
  await rules.privileged((db) => setDoc(fileRef(db, "file-seeded"), newCardFile(TEACHER, COURSE_ID, "file-seeded", CARD_ID)));
}

describe("팀원의 첨부 파일 목록 쓰기", () => {
  it("만든다 (saveCardFileRecord와 같은 모양)", async () => {
    await assertSucceeds(setDoc(fileRef(rules.as(TEACHER2)), newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID)));
  });

  it("끝값: 크기 100MB, 이름 200자는 통과한다", async () => {
    const name = `${"가".repeat(MAX_NAME - 4)}.pdf`;
    await assertSucceeds(
      setDoc(fileRef(rules.as(TEACHER2)), newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID, { name, size: MAX_BYTES })),
    );
  });

  it("다른 팀원이 올린 파일도 읽고 지운다", async () => {
    await seedFile();
    const db = rules.as(TEACHER2);
    await assertSucceeds(getDoc(fileRef(db, "file-seeded")));
    await assertSucceeds(getDocs(collection(db, "courses", COURSE_ID, "cardFiles")));
    await assertSucceeds(deleteDoc(fileRef(db, "file-seeded")));
  });
});

describe("막히는 경우", () => {
  it("초대받지 않은 사람은 읽지도 만들지도 지우지도 못한다", async () => {
    await seedFile();
    const db = rules.as(STRANGER);
    await assertFails(getDoc(fileRef(db, "file-seeded")));
    await assertFails(setDoc(fileRef(db), newCardFile(STRANGER, COURSE_ID, FILE_ID, CARD_ID)));
    await assertFails(deleteDoc(fileRef(db, "file-seeded")));
  });

  it("휴지통 과정에는 강사가 만들 수 없다", async () => {
    await assertFails(
      setDoc(
        fileRef(rules.as(TEACHER2), FILE_ID, TRASHED_COURSE_ID),
        newCardFile(TEACHER2, TRASHED_COURSE_ID, FILE_ID, CARD_ID),
      ),
    );
  });

  it("저장 위치가 이 문서와 맞지 않으면 막힌다 (남의 uid·다른 과정·다른 카드·다른 id·다른 이름·예전 위치)", async () => {
    const db = rules.as(TEACHER2);
    const base = newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID);
    const me = uidOf(TEACHER2);
    const wrongPaths = [
      `materials/${uidOf(TEACHER)}/${COURSE_ID}/${CARD_ID}/${FILE_ID}/교안 초안.pdf`,
      `materials/${me}/${TRASHED_COURSE_ID}/${CARD_ID}/${FILE_ID}/교안 초안.pdf`,
      `materials/${me}/${COURSE_ID}/${SECOND_CARD_ID}/${FILE_ID}/교안 초안.pdf`,
      `materials/${me}/${COURSE_ID}/${CARD_ID}/other-file/교안 초안.pdf`,
      `materials/${me}/${COURSE_ID}/${CARD_ID}/${FILE_ID}/다른 이름.pdf`,
      `courses/${COURSE_ID}/cardFiles/${FILE_ID}/교안 초안.pdf`,
    ];
    for (const storagePath of wrongPaths) {
      await assertFails(setDoc(fileRef(db), { ...base, storagePath }));
    }
  });

  it("없는 카드에는 붙일 수 없다", async () => {
    await assertFails(setDoc(fileRef(rules.as(TEACHER2)), newCardFile(TEACHER2, COURSE_ID, FILE_ID, "no-such-card")));
  });

  it("이름에 /가 있거나, 비었거나, 200자를 넘으면 막힌다", async () => {
    const db = rules.as(TEACHER2);
    for (const name of ["폴더/교안.pdf", "", `${"가".repeat(MAX_NAME)}.pdf`]) {
      await assertFails(setDoc(fileRef(db), newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID, { name })));
    }
  });

  it("크기가 0, 100MB 초과, 소수, 글자면 막힌다", async () => {
    const db = rules.as(TEACHER2);
    for (const size of [0, MAX_BYTES + 1, 10.5, "2048"]) {
      await assertFails(setDoc(fileRef(db), newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID, { size })));
    }
  });

  it("빠진 칸이나 모르는 칸이 있으면 막힌다", async () => {
    const db = rules.as(TEACHER2);
    const base = newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID);
    await assertFails(setDoc(fileRef(db), withoutField(base, "contentType")));
    await assertFails(setDoc(fileRef(db), { ...base, url: "https://example.com/file.pdf" }));
  });

  it("다른 사람 이름으로 만들 수 없다", async () => {
    await assertFails(
      setDoc(fileRef(rules.as(TEACHER2)), newCardFile(TEACHER2, COURSE_ID, FILE_ID, CARD_ID, { createdBy: TEACHER })),
    );
  });

  it("만든 뒤에는 고칠 수 없다 (이름·카드를 바꾸지 못한다)", async () => {
    await seedFile();
    const db = rules.as(TEACHER);
    await assertFails(updateDoc(fileRef(db, "file-seeded"), { name: "바꾼 이름.pdf", ...touch(TEACHER) }));
    await assertFails(updateDoc(fileRef(db, "file-seeded"), { cardId: "card-2", ...touch(TEACHER) }));
  });
});
