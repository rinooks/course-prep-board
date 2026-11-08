import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_FILE_MAX_BYTES,
  CARD_FILE_NAME_MAX,
  CARD_FILE_TYPES,
  CARD_FILES_PER_CARD,
  cardFilePath,
  checkCardFile,
  cleanFileName,
  contentDispositionFor,
  contentTypeFor,
  countFilesByCard,
  fileExtension,
  fileSlotsLeft,
  formatFileSize,
  groupFilesByCard,
  uploadPercent,
} from "@/lib/domain/cardFiles";

const MB = 1024 * 1024;

describe("확장자와 형식", () => {
  it("마지막 점 뒤를 소문자로", () => {
    expect(fileExtension("보고서.final.PDF")).toBe("pdf");
    expect(fileExtension("README")).toBe("");
    expect(fileExtension(".env")).toBe("");
    expect(fileExtension("끝이점.")).toBe("");
  });

  it("허용 목록에 있는 확장자만 형식이 정해진다", () => {
    expect(contentTypeFor("교안.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(contentTypeFor("계획서.HWP")).toBe("application/x-hwp");
    expect(contentTypeFor("page.html")).toBeNull();
    expect(contentTypeFor("logo.svg")).toBeNull();
    expect(contentTypeFor("setup.exe")).toBeNull();
    expect(contentTypeFor("이름없음")).toBeNull();
  });
});

describe("파일 이름 다듬기", () => {
  it("맥에서 온 분리된 한글(NFD)을 합친다(NFC)", () => {
    const decomposed = "교안.pdf".normalize("NFD");
    expect(decomposed).not.toBe("교안.pdf");
    expect(cleanFileName(decomposed)).toBe("교안.pdf");
  });

  it("경로에 문제가 되는 글자는 _로, 보이지 않는 문자는 지운다", () => {
    expect(cleanFileName("A사/B팀\\자료?#1.pdf")).toBe("A사_B팀_자료__1.pdf");
    expect(cleanFileName("보​고\u0007서﻿.pdf")).toBe("보고서.pdf");
  });

  it("앞의 점과 앞뒤 공백을 떼고, 공백은 하나로 줄인다", () => {
    expect(cleanFileName("  ..숨김   파일 .pdf ")).toBe("숨김 파일.pdf");
  });

  it("이름이 비면 '파일'로 채운다", () => {
    expect(cleanFileName(".pdf")).toBe("pdf");
    expect(cleanFileName("///.pdf")).toBe("___.pdf");
    expect(cleanFileName("   ")).toBe("파일");
  });

  it("너무 길면 확장자는 남기고 앞을 자른다", () => {
    const name = cleanFileName(`${"가".repeat(300)}.pptx`);
    expect(name.length).toBe(CARD_FILE_NAME_MAX);
    expect(name.endsWith(".pptx")).toBe(true);
  });

  it("자를 때 이모지(두 칸짜리 글자)를 반으로 쪼개지 않는다", () => {
    const name = cleanFileName(`${"😀".repeat(150)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(CARD_FILE_NAME_MAX);
    expect(name.endsWith(".pdf")).toBe(true);
    // 쪼개진 반쪽 글자(lone surrogate)가 없으면 encodeURIComponent가 오류를 내지 않는다
    expect(() => encodeURIComponent(name)).not.toThrow();
  });
});

describe("올릴 수 있는지 검사", () => {
  it("허용 형식·크기는 통과하고 다듬은 이름과 형식을 돌려준다", () => {
    expect(checkCardFile({ name: "회의록.DOCX", size: 2 * MB })).toEqual({
      ok: true,
      value: {
        name: "회의록.DOCX",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  });

  it("크기 끝값: 100MB는 통과, 1바이트라도 넘으면 막는다", () => {
    expect(checkCardFile({ name: "녹음.m4a", size: CARD_FILE_MAX_BYTES }).ok).toBe(true);
    const tooBig = checkCardFile({ name: "녹음.m4a", size: CARD_FILE_MAX_BYTES + 1 });
    expect(tooBig.ok).toBe(false);
    expect(!tooBig.ok && tooBig.message).toContain("100MB 이하");
  });

  it("빈 파일은 막는다", () => {
    const result = checkCardFile({ name: "빈.pdf", size: 0 });
    expect(!result.ok && result.message).toContain("비어 있습니다");
  });

  it("허용하지 않는 형식은 이유와 함께 막는다", () => {
    const result = checkCardFile({ name: "악성.html", size: 100 });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("올릴 수 없는 형식");
  });

  it("카드당 개수: 남은 자리를 센다", () => {
    expect(fileSlotsLeft(0)).toBe(CARD_FILES_PER_CARD);
    expect(fileSlotsLeft(CARD_FILES_PER_CARD - 1)).toBe(1);
    expect(fileSlotsLeft(CARD_FILES_PER_CARD + 3)).toBe(0);
  });
});

describe("표시와 저장 위치", () => {
  it("크기를 읽기 쉽게", () => {
    expect(formatFileSize(512)).toBe("512B");
    expect(formatFileSize(12_300)).toBe("12KB");
    expect(formatFileSize(2.34 * MB)).toBe("2.3MB");
    expect(formatFileSize(45.6 * MB)).toBe("46MB");
    expect(formatFileSize(1.5 * 1024 * MB)).toBe("1.5GB");
  });

  it("진행률은 0~100 정수", () => {
    expect(uploadPercent(0, 0)).toBe(0);
    expect(uploadPercent(1, 3)).toBe(33);
    expect(uploadPercent(5, 4)).toBe(100);
  });

  it("저장 위치는 materials/올린 사람 uid/과정/카드/파일id/이름", () => {
    expect(cardFilePath("uid1", "course1", "card1", "file1", "교안.pdf")).toBe(
      "materials/uid1/course1/card1/file1/교안.pdf",
    );
  });

  it("내려받을 때 한글 이름이 유지되도록 인코딩한다", () => {
    expect(contentDispositionFor("교안 (최종).pdf")).toBe(
      "inline; filename*=UTF-8''%EA%B5%90%EC%95%88%20%28%EC%B5%9C%EC%A2%85%29.pdf",
    );
  });
});

describe("카드별로 묶기", () => {
  const files = [
    { id: "c", cardId: "card-1", createdAt: null },
    { id: "b", cardId: "card-1", createdAt: 2000 },
    { id: "a", cardId: "card-1", createdAt: 1000 },
    { id: "d", cardId: "card-2", createdAt: 500 },
  ];

  it("올린 순서로 정렬하고, 서버 시각이 아직 없는 방금 올린 파일은 맨 뒤", () => {
    const groups = groupFilesByCard(files);
    expect(groups["card-1"].map((file) => file.id)).toEqual(["a", "b", "c"]);
    expect(groups["card-2"].map((file) => file.id)).toEqual(["d"]);
  });

  it("카드별 개수", () => {
    expect(countFilesByCard(files)).toEqual({ "card-1": 3, "card-2": 1 });
  });
});

describe("제한값이 보안 규칙과 같은지", () => {
  const storageRules = readFileSync(resolve(__dirname, "../../storage.rules"), "utf8");

  function storageNumber(name: string): number {
    const match = new RegExp(`function ${name}\\(\\) \\{ return (\\d+); \\}`).exec(storageRules);
    if (!match) throw new Error(`storage.rules에 ${name}()가 없습니다`);
    return Number(match[1]);
  }

  it("파일 크기·이름 길이", () => {
    expect(storageNumber("maxFileBytes")).toBe(CARD_FILE_MAX_BYTES);
    expect(storageNumber("maxFileNameLength")).toBe(CARD_FILE_NAME_MAX);
  });

  it("허용 형식 목록이 CARD_FILE_TYPES와 정확히 같다", () => {
    const block = /function allowedContentTypes\(\) \{\s*return \[([\s\S]*?)\];/.exec(storageRules);
    if (!block) throw new Error("storage.rules에 allowedContentTypes()가 없습니다");
    const inRules = Array.from(block[1].matchAll(/'([^']+)'/g), (match) => match[1]).sort();
    const inCode = Array.from(new Set(Object.values(CARD_FILE_TYPES))).sort();
    expect(inRules).toEqual(inCode);
  });

  it("첫 관리자 이메일이 storage.rules와 firestore.rules에서 같다", () => {
    const firestoreRules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");
    const pattern = /function bootstrapEmail\(\) \{ return '([^']+)'; \}/;
    expect(pattern.exec(storageRules)?.[1]).toBe(pattern.exec(firestoreRules)?.[1]);
  });
});
