// 서버 함수(functions/src/lectureRules.ts)의 판단 규칙과, 웹 앱과 겹쳐 적은 값이 같은지 검사한다.

import { describe, expect, it } from "vitest";
import {
  activityIdFor,
  activityMessage,
  decideLectureUpload,
  displayNameOf,
  isLectureFile,
  isTooOld,
  LECTURE_EXTENSIONS,
  MAX_EVENT_AGE_MS,
  MOVE_FROM_STAGES,
  MOVE_TO_STAGE,
  ORDER_STEP,
  orderAtEnd,
  parseMaterialPath,
  STAGE_LABELS,
} from "@/functions/src/lectureRules";
import { CARD_FILE_TYPES, cardFilePath } from "@/lib/domain/cardFiles";
import { ORDER_STEP as WEB_ORDER_STEP, orderAtEnd as webOrderAtEnd } from "@/lib/domain/ordering";
import { STAGES } from "@/lib/domain/stages";

const FACTS = {
  uploaderEmail: "kim@example.com",
  cardCreatedBy: "kim@example.com",
  cardStage: "lecture",
  cardTrashed: false,
  courseTrashed: false,
};

describe("저장 위치 나누기", () => {
  it("웹 앱이 만드는 위치를 그대로 나눈다", () => {
    const path = cardFilePath("uid-1", "course1", "card1", "file1", "A사 교안 (최종).pptx");
    expect(parseMaterialPath(path)).toEqual({
      uid: "uid-1",
      courseId: "course1",
      cardId: "card1",
      fileId: "file1",
      fileName: "A사 교안 (최종).pptx",
    });
  });

  it("materials/ 밖, 칸 수가 다른 위치, 이상한 id는 null", () => {
    expect(parseMaterialPath("courses/course1/cardFiles/file1/교안.pdf")).toBeNull();
    expect(parseMaterialPath("materials/uid/course1/card1/교안.pdf")).toBeNull();
    expect(parseMaterialPath("materials/uid/course1/card1/file1/폴더/교안.pdf")).toBeNull();
    expect(parseMaterialPath("materials/uid/course.1/card1/file1/교안.pdf")).toBeNull();
    expect(parseMaterialPath("materials/uid/course1/card1/file1/")).toBeNull();
  });
});

describe("교안 형식", () => {
  it("PPT·PPTX·PDF만 교안으로 본다 (대소문자 무관)", () => {
    expect(isLectureFile("교안.pptx")).toBe(true);
    expect(isLectureFile("교안.PPT")).toBe(true);
    expect(isLectureFile("교안.Pdf")).toBe(true);
    expect(isLectureFile("사진.png")).toBe(false);
    expect(isLectureFile("견적.xlsx")).toBe(false);
    expect(isLectureFile("pptx")).toBe(false);
  });

  it("교안 형식은 모두 카드에 올릴 수 있는 형식이다", () => {
    for (const extension of LECTURE_EXTENSIONS) {
      expect(CARD_FILE_TYPES[extension]).toBeDefined();
    }
  });
});

describe("옮길지 정하기", () => {
  it("카드 작성자가 '교안'·'고객사 요청 확인' 단계 카드에 올리면 옮긴다", () => {
    expect(decideLectureUpload(FACTS)).toEqual({ action: "record", move: true });
    expect(decideLectureUpload({ ...FACTS, cardStage: "request" })).toEqual({ action: "record", move: true });
  });

  it("다른 단계 카드면 옮기지 않고 기록만 남긴다", () => {
    expect(decideLectureUpload({ ...FACTS, cardStage: "practice" })).toEqual({ action: "record", move: false });
    expect(decideLectureUpload({ ...FACTS, cardStage: "rehearsal" })).toEqual({ action: "record", move: false });
  });

  it("이메일 대소문자는 가리지 않는다", () => {
    expect(decideLectureUpload({ ...FACTS, cardCreatedBy: "Kim@Example.com" }).action).toBe("record");
  });

  it("올린 사람이 카드 작성자가 아니면 아무것도 하지 않는다", () => {
    const result = decideLectureUpload({ ...FACTS, uploaderEmail: "lee@example.com" });
    expect(result.action).toBe("skip");
  });

  it("휴지통에 있는 과정·카드는 건드리지 않는다", () => {
    expect(decideLectureUpload({ ...FACTS, courseTrashed: true }).action).toBe("skip");
    expect(decideLectureUpload({ ...FACTS, cardTrashed: true }).action).toBe("skip");
  });
});

describe("기록 내용", () => {
  it("옮겼을 때 문장", () => {
    expect(
      activityMessage({ actorName: "김강사", fileName: "A사_교안.pptx", cardTitle: "교안 작성", fromStage: "lecture", moved: true }),
    ).toBe("김강사님이 「A사_교안.pptx」 교안을 올려 '교안 작성' 카드를 '교안'에서 '리허설'로 옮겼습니다.");
  });

  it("옮기지 않았을 때 문장", () => {
    expect(
      activityMessage({ actorName: "김강사", fileName: "교안.pdf", cardTitle: "실습 안내서", fromStage: "practice", moved: false }),
    ).toBe("김강사님이 '실습 안내서' 카드에 「교안.pdf」 교안을 올렸습니다.");
  });

  it("이름이 없으면 이메일 앞부분", () => {
    expect(displayNameOf("  ", "kim@example.com")).toBe("kim");
    expect(displayNameOf("김강사", "kim@example.com")).toBe("김강사");
  });

  it("같은 파일은 같은 기록 id (두 번 와도 한 번만 처리)", () => {
    expect(activityIdFor("file1")).toBe(activityIdFor("file1"));
    expect(activityIdFor("file1")).not.toBe(activityIdFor("file2"));
  });

  it("한 시간 넘은 알림은 포기한다", () => {
    const created = Date.parse("2026-10-25T00:00:00Z");
    expect(isTooOld("2026-10-25T00:00:00Z", created + MAX_EVENT_AGE_MS)).toBe(false);
    expect(isTooOld("2026-10-25T00:00:00Z", created + MAX_EVENT_AGE_MS + 1)).toBe(true);
  });
});

describe("웹 앱과 겹쳐 적은 값이 같은지", () => {
  it("단계 id와 이름", () => {
    expect(STAGE_LABELS).toEqual(Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label])));
  });

  it("옮기는 단계는 실제로 있는 단계다", () => {
    const ids = STAGES.map((stage) => stage.id as string);
    for (const stage of [...MOVE_FROM_STAGES, MOVE_TO_STAGE]) expect(ids).toContain(stage);
  });

  it("순서 간격과 맨 아래 자리 계산", () => {
    expect(ORDER_STEP).toBe(WEB_ORDER_STEP);
    for (const orders of [[], [1024], [3000, 1024, 2048]]) {
      expect(orderAtEnd(orders)).toBe(webOrderAtEnd(orders));
    }
  });
});
