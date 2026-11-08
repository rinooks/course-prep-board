// 교안이 올라오면 카드를 리허설 단계로 옮기고 최근 활동에 기록한다 (PRD F9, L7).
//
// 언제: Storage materials/{올린 사람 uid}/{과정}/{카드}/{파일 id}/{이름}에 파일이 다 올라왔을 때.
//       (카드 첨부 파일이 이 위치로 올라간다. storage.rules가 "경로의 uid = 올린 본인"을 강제한다)
// 지역: 버킷과 같은 us-east1이어야 배포된다 (다르면 배포가 실패한다).
// 순서: 교안 형식인지 → 올린 사람(uid → 팀원 이메일)이 카드 작성자인지 → 한 묶음(트랜잭션)으로
//       카드 옮기기 + 활동 기록. 같은 알림이 두 번 와도 기록 id(lecture-{파일 id})가 같아 한 번만 처리된다.
// 이 함수는 관리자 권한(Admin SDK)으로 쓰므로 보안 규칙을 거치지 않는다. 그래서 값을 여기서 직접 확인한다.

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import {
  ACTIVITY_COLLECTION,
  activityIdFor,
  activityMessage,
  decideLectureUpload,
  displayNameOf,
  isLectureFile,
  isTooOld,
  MOVE_TO_STAGE,
  orderAtEnd,
  parseMaterialPath,
} from "./lectureRules";

/** 이 프로젝트의 기본 Storage 버킷 (us-east1). 지정하지 않으면 모든 버킷에 반응한다 */
const BUCKET = "edu-project-f1d12.firebasestorage.app";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const onLectureUploaded = onObjectFinalized(
  {
    bucket: BUCKET,
    region: "us-east1",
    // 일시적인 오류(네트워크 등)로 실패하면 다시 시도한다. 같은 파일은 한 번만 처리되므로 안전하다
    retry: true,
    memory: "256MiB",
    maxInstances: 5,
  },
  async (event) => {
    const objectName = event.data.name;
    const path = parseMaterialPath(objectName);
    // materials/ 밖의 파일(예전 첨부 위치 등)은 이 기능과 관계없다
    if (!path) return;

    const where = { 파일: objectName };
    if (isTooOld(event.time, Date.now())) {
      logger.error("한 시간 넘게 처리하지 못해 이 파일은 포기합니다. 위 오류 로그를 확인해 주세요.", where);
      return;
    }
    if (!isLectureFile(path.fileName)) {
      logger.info("교안 형식(PPT·PPTX·PDF)이 아니라 건너뜁니다.", where);
      return;
    }

    const db = getFirestore();
    const memberSnap = await db.collection("members").where("uid", "==", path.uid).limit(1).get();
    if (memberSnap.empty) {
      logger.warn("올린 사람을 팀원 명단에서 찾지 못해 건너뜁니다.", where);
      return;
    }
    const member = memberSnap.docs[0];
    const uploaderEmail = member.id;
    const actorName = displayNameOf(member.get("displayName"), uploaderEmail);

    const courseRef = db.collection("courses").doc(path.courseId);
    const cardRef = courseRef.collection("cards").doc(path.cardId);
    const activityRef = db.collection(ACTIVITY_COLLECTION).doc(activityIdFor(path.fileId));

    const outcome = await db.runTransaction(async (tx) => {
      const [activitySnap, courseSnap, cardSnap] = await tx.getAll(activityRef, courseRef, cardRef);
      if (activitySnap.exists) return "이미 처리한 파일이라 건너뜁니다.";
      if (!courseSnap.exists || !cardSnap.exists) return "과정이나 카드를 찾지 못해 건너뜁니다.";

      const card = cardSnap.data() ?? {};
      const course = courseSnap.data() ?? {};
      const cardStage = text(card.stage);
      const decision = decideLectureUpload({
        uploaderEmail,
        cardCreatedBy: text(card.createdBy),
        cardStage,
        cardTrashed: card.deletedAt != null,
        courseTrashed: course.deletedAt != null,
      });
      if (decision.action === "skip") return decision.reason;

      if (decision.move) {
        // 트랜잭션은 읽기를 모두 마친 뒤에 써야 하므로 리허설 단계 카드를 먼저 읽는다
        const rehearsalSnap = await tx.get(courseRef.collection("cards").where("stage", "==", MOVE_TO_STAGE));
        const orders = rehearsalSnap.docs
          .filter((doc) => doc.get("deletedAt") == null)
          .map((doc) => numberOr(doc.get("order"), 0));
        tx.update(cardRef, {
          stage: MOVE_TO_STAGE,
          order: orderAtEnd(orders),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uploaderEmail,
        });
      }

      const cardTitle = text(card.title) || "(제목 없음)";
      tx.create(activityRef, {
        kind: "lecture-uploaded",
        courseId: path.courseId,
        courseTitle: text(course.title),
        cardId: path.cardId,
        cardTitle,
        actorEmail: uploaderEmail,
        actorName,
        fileName: path.fileName,
        fromStage: cardStage,
        toStage: decision.move ? MOVE_TO_STAGE : null,
        message: activityMessage({ actorName, fileName: path.fileName, cardTitle, fromStage: cardStage, moved: decision.move }),
        createdAt: FieldValue.serverTimestamp(),
      });
      return decision.move
        ? "카드를 리허설 단계로 옮기고 최근 활동에 기록했습니다."
        : "카드는 그대로 두고 최근 활동에만 기록했습니다.";
    });

    logger.info(outcome, where);
  },
);
