import { describe, expect, it } from "vitest";
import {
  coursesOfClient,
  clientNameKey,
  findClientByName,
  isDuplicateClientName,
  isPhoneValue,
  mailtoHref,
  telHref,
} from "@/lib/domain/clients";
import {
  feeStatus,
  formatWon,
  overdueDays,
  parseWon,
  shouldRemindOverdue,
  sortFees,
  suggestDueDate,
  summarizeFees,
  type FeeLike,
} from "@/lib/domain/fees";
import {
  LIMITS,
  validateClientInput,
  validateContactInput,
  validateContactPatch,
  validateFeeInput,
  validateFeePatch,
} from "@/lib/domain/validation";

const TODAY = "2026-10-12";

function fee(id: string, dueDate: string, paidDate: string | null = null, amount = 100_000): FeeLike {
  return { id, amount, dueDate, paidDate };
}

describe("강사료 상태", () => {
  it("입금일이 있으면 입금됨, 예정일이 지났으면 미입금, 예정일 당일까지는 받을 예정", () => {
    expect(feeStatus(fee("a", "2026-10-01", "2026-10-02"), TODAY)).toBe("paid");
    expect(feeStatus(fee("b", "2026-10-11"), TODAY)).toBe("overdue");
    expect(feeStatus(fee("c", TODAY), TODAY)).toBe("upcoming");
    expect(feeStatus(fee("d", "2026-11-01"), TODAY)).toBe("upcoming");
  });

  it("예정일이 지난 날 수를 센다 (입금됐거나 안 지났으면 0)", () => {
    expect(overdueDays(fee("a", "2026-10-02"), TODAY)).toBe(10);
    expect(overdueDays(fee("b", TODAY), TODAY)).toBe(0);
    expect(overdueDays(fee("c", "2026-10-02", "2026-10-10"), TODAY)).toBe(0);
  });

  it("미입금 메일은 예정일 다음 날, 그 뒤 7일마다", () => {
    const remindDays = Array.from({ length: 20 }, (_, index) => index).filter((days) =>
      shouldRemindOverdue(fee("a", "2026-10-01"), addDaysForTest("2026-10-01", days)),
    );
    expect(remindDays).toEqual([1, 8, 15]);
    expect(shouldRemindOverdue(fee("b", "2026-10-11", "2026-10-11"), TODAY)).toBe(false);
  });

  it("상태별 건수와 금액을 더한다", () => {
    const summary = summarizeFees(
      [
        fee("a", "2026-10-01", null, 300_000),
        fee("b", "2026-10-20", null, 500_000),
        fee("c", "2026-10-30", null, 200_000),
        fee("d", "2026-09-30", "2026-10-05", 1_000_000),
      ],
      TODAY,
    );
    expect(summary).toEqual({
      overdue: { count: 1, amount: 300_000 },
      upcoming: { count: 2, amount: 700_000 },
      paid: { count: 1, amount: 1_000_000 },
    });
  });

  it("미입금(오래된 순) → 받을 예정(예정일 순) → 입금됨(최근 입금 순)", () => {
    const sorted = sortFees(
      [
        fee("paid-old", "2026-09-01", "2026-09-05"),
        fee("upcoming-late", "2026-11-30"),
        fee("overdue-recent", "2026-10-10"),
        fee("paid-new", "2026-09-20", "2026-10-01"),
        fee("upcoming-soon", "2026-10-15"),
        fee("overdue-old", "2026-09-30"),
      ],
      TODAY,
    );
    expect(sorted.map((item) => item.id)).toEqual([
      "overdue-old",
      "overdue-recent",
      "upcoming-soon",
      "upcoming-late",
      "paid-new",
      "paid-old",
    ]);
  });

  it("입금 예정일 기본값은 마지막 강의 날(없으면 오늘)부터 30일 뒤", () => {
    expect(suggestDueDate("2026-10-20", TODAY)).toBe("2026-11-19");
    expect(suggestDueDate(null, TODAY)).toBe("2026-11-11");
  });
});

describe("금액 표시와 읽기", () => {
  it("천 단위 쉼표와 '원'을 붙인다", () => {
    expect(formatWon(1_200_000)).toBe("1,200,000원");
  });

  it("쉼표·원·띄어쓰기·전각 숫자를 빼고 정수로 읽는다", () => {
    expect(parseWon("1,200,000원")).toBe(1_200_000);
    expect(parseWon(" 500000 ")).toBe(500_000);
    expect(parseWon("１２３")).toBe(123);
    expect(parseWon("12.5")).toBeNull();
    expect(parseWon("-100")).toBeNull();
    expect(parseWon("백만원")).toBeNull();
    expect(parseWon("")).toBeNull();
  });
});

describe("강사료 입력 검사", () => {
  const base = {
    courseId: "course-1",
    instructorEmail: " Teacher@Example.com ",
    label: " 1회차 ",
    amount: "1,200,000",
    dueDate: "2026-11-30",
    paidDate: null,
    memo: "",
  };

  it("금액 글자를 정수로 바꾸고 이메일을 소문자로 정리한다", () => {
    const result = validateFeeInput(base);
    expect(result).toEqual({
      ok: true,
      value: { ...base, instructorEmail: "teacher@example.com", label: "1회차", amount: 1_200_000 },
    });
  });

  it("금액이 비었거나 숫자가 아니거나 0원이거나 너무 크면 막는다", () => {
    const messages = ["", "abc", "0", String(LIMITS.feeAmount + 1)].map((amount) => {
      const result = validateFeeInput({ ...base, amount });
      return result.ok ? null : result.errors.amount;
    });
    expect(messages[0]).toBe("금액을 입력해 주세요.");
    expect(messages[1]).toContain("숫자로만");
    expect(messages[2]).toContain("1원 이상");
    expect(messages[3]).toContain("1,000,000,000원 이하");
  });

  it("예정일은 필수, 입금일은 비워도 되지만 있으면 진짜 날짜여야 한다", () => {
    const noDue = validateFeeInput({ ...base, dueDate: "" });
    expect(noDue.ok === false && noDue.errors.dueDate).toBe("입금 예정일을 골라 주세요.");
    const badPaid = validateFeeInput({ ...base, paidDate: "2026-02-30" });
    expect(badPaid.ok === false && badPaid.errors.paidDate).toContain("입금일을");
    const emptyPaid = validateFeeInput({ ...base, paidDate: "  " });
    expect(emptyPaid.ok && emptyPaid.value.paidDate).toBeNull();
  });

  it("고칠 때는 넘어온 칸만 돌려준다", () => {
    expect(validateFeePatch({ paidDate: "2026-10-12" })).toEqual({ ok: true, value: { paidDate: "2026-10-12" } });
    expect(validateFeePatch({ amount: "300,000" })).toEqual({ ok: true, value: { amount: 300_000 } });
    const bad = validateFeePatch({ amount: "0" });
    expect(bad.ok).toBe(false);
  });
});

describe("고객사 이름 맞추기", () => {
  const clients = [
    { id: "samsung", name: "삼성전자(주)" },
    { id: "lg", name: "LG 화학" },
  ];

  it("띄어쓰기·대소문자·(주)·주식회사 차이는 같은 이름으로 본다", () => {
    expect(clientNameKey(" 주식회사 삼성 전자 ")).toBe("삼성전자");
    expect(findClientByName(clients, "삼성전자")?.id).toBe("samsung");
    expect(findClientByName(clients, "lg화학")?.id).toBe("lg");
    expect(findClientByName(clients, "현대자동차")).toBeNull();
    expect(findClientByName(clients, "  ")).toBeNull();
  });

  it("같은 이름이 있는지 (고칠 때는 자기 자신 제외)", () => {
    expect(isDuplicateClientName(clients, "㈜삼성전자")).toBe(true);
    expect(isDuplicateClientName(clients, "삼성전자", "samsung")).toBe(false);
    expect(isDuplicateClientName(clients, "카카오")).toBe(false);
  });

  it("이 고객사의 과정을 이름으로 찾는다", () => {
    const courses = [
      { id: "c1", client: "삼성전자" },
      { id: "c2", client: "LG화학" },
      { id: "c3", client: "" },
    ];
    expect(coursesOfClient(courses, clients[0]).map((course) => course.id)).toEqual(["c1"]);
  });
});

describe("담당자 연락처", () => {
  it("전화번호는 숫자와 + - ( ) . 띄어쓰기만, 숫자가 하나는 있어야 한다", () => {
    expect(isPhoneValue("010-1234-5678")).toBe(true);
    expect(isPhoneValue("+82 (2) 123.4567")).toBe(true);
    expect(isPhoneValue("")).toBe(true);
    expect(isPhoneValue("---")).toBe(false);
    expect(isPhoneValue("02-123-4567 내선 3")).toBe(false);
  });

  it("전화·메일 링크", () => {
    expect(telHref("010-1234-5678")).toBe("tel:01012345678");
    expect(telHref("+82 10 1234 5678")).toBe("tel:+821012345678");
    expect(telHref("")).toBeNull();
    expect(mailtoHref("kim@a.com")).toBe("mailto:kim@a.com");
    expect(mailtoHref("")).toBeNull();
  });

  it("담당자 입력을 정리하고 검사한다", () => {
    const ok = validateContactInput({
      clientId: "samsung",
      name: " 김담당 ",
      role: "인재개발팀 과장",
      phone: "010-1234-5678",
      email: "Kim@Samsung.com",
      memo: "",
    });
    expect(ok.ok && ok.value).toMatchObject({ name: "김담당", email: "kim@samsung.com" });

    const bad = validateContactInput({
      clientId: "",
      name: "",
      role: "",
      phone: "내선 3",
      email: "not-email",
      memo: "",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(Object.keys(bad.errors).sort()).toEqual(["clientId", "email", "name", "phone"]);
    }
  });

  it("담당자 고치기는 넘어온 칸만", () => {
    expect(validateContactPatch({ phone: "02-555-0000" })).toEqual({ ok: true, value: { phone: "02-555-0000" } });
  });

  it("고객사 이름은 필수", () => {
    const result = validateClientInput({ name: "  ", memo: "" });
    expect(result.ok === false && result.errors.name).toBe("고객사 이름을 입력해 주세요.");
  });
});

/** 테스트 안에서만 쓰는 날짜 더하기 (lib/domain/dates의 addDays와 같은 결과) */
function addDaysForTest(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
