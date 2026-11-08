import { describe, expect, it } from "vitest";
import {
  countFeesByFilter,
  defaultInstructor,
  feeBadge,
  feeDatesText,
  feeDateLabel,
  feesHref,
  feeTitle,
  filterFees,
  instructorChoices,
  lastSessionDate,
  parseFeeFilter,
  parseFeeScope,
} from "@/components/fees/feeDisplay";
import {
  changedFeeFields,
  feeDraftErrors,
  feeDraftFrom,
  newFeeDraft,
  previewAmount,
  tidyAmountInput,
  toFeeInput,
} from "@/components/fees/feeForm";
import type { Fee } from "@/lib/data/types";
import { validateFeeInput, validateFeePatch } from "@/lib/domain/validation";

const TODAY = "2026-10-12";

function makeFee(overrides: Partial<Fee> & Pick<Fee, "id">): Fee {
  return {
    courseId: "course1",
    instructorEmail: "a@example.com",
    label: "",
    amount: 1_200_000,
    dueDate: "2026-11-01",
    paidDate: null,
    memo: "",
    createdBy: "a@example.com",
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "a@example.com",
    ...overrides,
  };
}

describe("강사료 표시 문구", () => {
  it("항목 이름이 비었으면 '강사료'로 보인다", () => {
    expect(feeTitle(makeFee({ id: "a", label: "1회차" }))).toBe("1회차");
    expect(feeTitle(makeFee({ id: "b", label: "  " }))).toBe("강사료");
  });

  it("상태 배지: 미입금은 지난 날 수와 빨강, 받을 예정은 회색, 입금됨은 초록", () => {
    expect(feeBadge(makeFee({ id: "a", dueDate: "2026-10-02" }), TODAY)).toEqual({
      status: "overdue",
      text: "미입금 · 10일 지남",
      tone: "danger",
    });
    expect(feeBadge(makeFee({ id: "b", dueDate: TODAY }), TODAY)).toEqual({
      status: "upcoming",
      text: "받을 예정",
      tone: "neutral",
    });
    expect(feeBadge(makeFee({ id: "c", dueDate: "2026-10-02", paidDate: "2026-10-05" }), TODAY)).toEqual({
      status: "paid",
      text: "입금됨",
      tone: "success",
    });
  });

  it("저장된 예정일이 이상해도 멈추지 않는다", () => {
    expect(() => feeBadge(makeFee({ id: "a", dueDate: "" }), TODAY)).not.toThrow();
    expect(feeBadge(makeFee({ id: "a", dueDate: "" }), TODAY).text).toBe("미입금");
    expect(feeDateLabel("2026-13-40", TODAY)).toBe("날짜 확인 필요");
  });

  it("날짜 줄: 올해가 아니면 연도를 붙이고, 입금됐으면 입금일을 앞에 쓴다", () => {
    expect(feeDatesText(makeFee({ id: "a", dueDate: "2026-10-30" }), TODAY)).toBe("입금 예정 10월 30일 (금)");
    expect(feeDatesText(makeFee({ id: "b", dueDate: "2027-01-05" }), TODAY)).toBe("입금 예정 2027년 1월 5일 (화)");
    expect(feeDatesText(makeFee({ id: "c", dueDate: "2026-10-30", paidDate: "2026-10-20" }), TODAY)).toBe(
      "입금 10월 20일 (화) · 예정 10월 30일 (금)",
    );
  });
});

describe("강사료 걸러 보기", () => {
  const fees = [
    makeFee({ id: "late", dueDate: "2026-10-01" }),
    makeFee({ id: "soon", dueDate: "2026-10-20" }),
    makeFee({ id: "done", dueDate: "2026-09-01", paidDate: "2026-09-03" }),
  ];

  it("주소의 status·scope 값을 읽는다 (모르는 값은 기본값)", () => {
    expect(parseFeeFilter("overdue")).toBe("overdue");
    expect(parseFeeFilter("paid")).toBe("paid");
    expect(parseFeeFilter("OVERDUE")).toBe("all");
    expect(parseFeeFilter(null)).toBe("all");
    expect(parseFeeScope("mine")).toBe("mine");
    expect(parseFeeScope("everyone")).toBe("team");
    expect(parseFeeScope(null)).toBe("team");
  });

  it("주소 만들기: 기본값은 적지 않는다", () => {
    expect(feesHref("all", "team")).toBe("/fees");
    expect(feesHref("overdue", "team")).toBe("/fees?status=overdue");
    expect(feesHref("paid", "mine")).toBe("/fees?status=paid&scope=mine");
    expect(feesHref("all", "mine")).toBe("/fees?scope=mine");
  });

  it("상태로 거르고 건수를 센다", () => {
    expect(filterFees(fees, "all", TODAY).map((fee) => fee.id)).toEqual(["late", "soon", "done"]);
    expect(filterFees(fees, "overdue", TODAY).map((fee) => fee.id)).toEqual(["late"]);
    expect(filterFees(fees, "upcoming", TODAY).map((fee) => fee.id)).toEqual(["soon"]);
    expect(filterFees(fees, "paid", TODAY).map((fee) => fee.id)).toEqual(["done"]);
    expect(countFeesByFilter(fees, TODAY)).toEqual({ all: 3, overdue: 1, upcoming: 1, paid: 1 });
  });
});

describe("강사료 추가 창 기본값", () => {
  it("마지막 강의 날: 가장 늦은 날짜, 이상한 날짜는 건너뛴다", () => {
    expect(lastSessionDate([])).toBeNull();
    expect(lastSessionDate([{ date: "2026-10-20" }, { date: "2026-11-03" }, { date: "2026-10-27" }])).toBe("2026-11-03");
    expect(lastSessionDate([{ date: "망가진 값" }, { date: "2026-10-20" }])).toBe("2026-10-20");
  });

  it("받는 강사 선택지: 담당 강사 먼저, 팀원이 아닌 담당 강사는 뺀다", () => {
    const choices = instructorChoices(
      ["b@example.com", "gone@example.com"],
      ["admin@example.com", "a@example.com", "b@example.com"],
      "admin@example.com",
    );
    expect(choices).toEqual([
      { email: "b@example.com", isCourseInstructor: true },
      { email: "admin@example.com", isCourseInstructor: false },
      { email: "a@example.com", isCourseInstructor: false },
    ]);
  });

  it("팀원 목록을 아직 못 받았으면 담당 강사와 나만", () => {
    expect(instructorChoices(["b@example.com"], null, "admin@example.com")).toEqual([
      { email: "b@example.com", isCourseInstructor: true },
      { email: "admin@example.com", isCourseInstructor: false },
    ]);
  });

  it("받는 강사 처음 값: 강사는 나, 관리자는 담당 강사인 나 → 한 명뿐인 담당 강사 → 빈 값", () => {
    const members = ["admin@example.com", "a@example.com", "b@example.com"];
    expect(defaultInstructor(instructorChoices(["a@example.com"], members, "a@example.com"), "a@example.com", false)).toBe(
      "a@example.com",
    );
    expect(
      defaultInstructor(
        instructorChoices(["a@example.com", "admin@example.com"], members, "admin@example.com"),
        "admin@example.com",
        true,
      ),
    ).toBe("admin@example.com");
    expect(
      defaultInstructor(instructorChoices(["b@example.com"], members, "admin@example.com"), "admin@example.com", true),
    ).toBe("b@example.com");
    expect(
      defaultInstructor(
        instructorChoices(["a@example.com", "b@example.com"], members, "admin@example.com"),
        "admin@example.com",
        true,
      ),
    ).toBe("");
  });
});

describe("강사료 입력 창", () => {
  it("금액 칸: 나갈 때 쉼표를 넣고, 숫자가 아니면 그대로 둔다", () => {
    expect(tidyAmountInput("1200000")).toBe("1,200,000");
    expect(tidyAmountInput("1,200,000원")).toBe("1,200,000");
    expect(tidyAmountInput("백만")).toBe("백만");
    expect(previewAmount("1200000")).toBe(1_200_000);
    expect(previewAmount("0")).toBeNull();
    expect(previewAmount("")).toBeNull();
  });

  it("새 강사료 저장 값은 데이터 계층 검사를 통과한다 (쉼표 금액 그대로)", () => {
    const draft = { ...newFeeDraft("a@example.com", "2026-11-11"), label: "1회차", amount: "1,200,000" };
    const input = toFeeInput(draft, "course1");
    expect(input.paidDate).toBeNull();
    const check = validateFeeInput({
      courseId: input.courseId,
      instructorEmail: input.instructorEmail,
      label: input.label ?? "",
      amount: input.amount,
      dueDate: input.dueDate,
      paidDate: input.paidDate ?? null,
      memo: input.memo ?? "",
    });
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.value.amount).toBe(1_200_000);
  });

  it("'이미 입금됨'을 켜고 입금일을 비우면 막는다 (그대로 보내면 입금 전으로 저장되므로)", () => {
    const draft = { ...newFeeDraft("a@example.com", "2026-11-11"), amount: "100", paid: true, paidDate: "" };
    expect(feeDraftErrors(draft).paidDate).toBeTruthy();
    expect(feeDraftErrors({ ...draft, paidDate: TODAY })).toEqual({});
    expect(feeDraftErrors({ ...draft, paid: false })).toEqual({});
    expect(toFeeInput({ ...draft, paid: false, paidDate: TODAY }, "course1").paidDate).toBeNull();
  });

  it("고치기: 바뀐 칸만 보내고, 쉼표만 다른 금액은 바뀐 것으로 보지 않는다", () => {
    const fee = makeFee({ id: "a", label: "선금", amount: 1_200_000, dueDate: "2026-11-01", memo: "메모" });
    const initial = feeDraftFrom(fee);
    expect(initial.amount).toBe("1,200,000");
    expect(changedFeeFields(initial, initial)).toEqual({});
    expect(changedFeeFields(initial, { ...initial, amount: "1200000" })).toEqual({});
    expect(changedFeeFields(initial, { ...initial, amount: "1,300,000", label: "잔금" })).toEqual({
      label: "잔금",
      amount: "1,300,000",
    });
    expect(changedFeeFields(initial, { ...initial, amount: "" })).toEqual({ amount: "" });
    expect(changedFeeFields(initial, { ...initial, paid: true, paidDate: TODAY })).toEqual({ paidDate: TODAY });
  });

  it("고치기: 입금 취소는 paidDate null로, 바뀐 값은 데이터 계층 검사를 통과한다", () => {
    const fee = makeFee({ id: "a", paidDate: "2026-10-05" });
    const initial = feeDraftFrom(fee);
    expect(initial.paid).toBe(true);
    const patch = changedFeeFields(initial, { ...initial, paid: false });
    expect(patch).toEqual({ paidDate: null });
    expect(validateFeePatch(patch).ok).toBe(true);
  });
});
