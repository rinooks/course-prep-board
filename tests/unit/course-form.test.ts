import { describe, expect, it } from "vitest";
import {
  firstErrorField,
  formErrorsFromSaveErrors,
  hasFirstSession,
  initialCourseFormValues,
  toggleInstructor,
  validateCourseForm,
  type CourseFormValues,
} from "@/components/course-form/courseFormState";

function formValues(overrides: Partial<CourseFormValues> = {}): CourseFormValues {
  return { ...initialCourseFormValues(null), title: "A사 신입사원 AI 활용 과정", ...overrides };
}

describe("initialCourseFormValues", () => {
  it("만드는 사람을 담당 강사로 미리 고른다 (소문자)", () => {
    expect(initialCourseFormValues("Kim@Example.com").instructorEmails).toEqual(["kim@example.com"]);
    expect(initialCourseFormValues(null).instructorEmails).toEqual([]);
  });
});

describe("toggleInstructor", () => {
  it("켜면 끝에 추가, 끄면 뺀다, 중복은 생기지 않는다", () => {
    expect(toggleInstructor(["a@x.com"], "b@x.com", true)).toEqual(["a@x.com", "b@x.com"]);
    expect(toggleInstructor(["a@x.com", "b@x.com"], "a@x.com", false)).toEqual(["b@x.com"]);
    expect(toggleInstructor(["a@x.com"], "a@x.com", true)).toEqual(["a@x.com"]);
  });
});

describe("validateCourseForm", () => {
  it("과정 이름만 있으면 회차 없이 통과한다", () => {
    const result = validateCourseForm(formValues({ title: "  과정  " }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("과정");
      expect(result.value.sessions).toEqual([]);
    }
  });

  it("과정 이름이 비면 title 오류", () => {
    const result = validateCourseForm(formValues({ title: "   " }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toContain("과정 이름");
      expect(firstErrorField(result.errors)).toBe("title");
    }
  });

  it("첫 강의 일정을 넣으면 회차 하나를 함께 만든다", () => {
    const result = validateCourseForm(
      formValues({
        sessionDate: "2026-10-20",
        sessionStartTime: "09:30",
        sessionLocation: " 본사 ",
        sessionAudience: "신입 30명",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sessions).toEqual([
        { date: "2026-10-20", startTime: "09:30", location: "본사", audience: "신입 30명", note: "" },
      ]);
    }
  });

  it("시간 없이 날짜만 넣어도 된다", () => {
    const result = validateCourseForm(formValues({ sessionDate: "2026-10-20" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sessions?.[0].startTime).toBeNull();
  });

  it("날짜 없이 장소만 넣으면 날짜 칸에 할 일을 알려 준다", () => {
    const values = formValues({ sessionLocation: "본사" });
    expect(hasFirstSession(values)).toBe(true);
    const result = validateCourseForm(values);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.sessionDate).toContain("비워 두면");
      expect(firstErrorField(result.errors)).toBe("sessionDate");
    }
  });

  it("과정 오류와 회차 오류를 함께 모은다 (첫 오류는 화면 순서)", () => {
    const result = validateCourseForm(formValues({ title: "", sessionDate: "2026-02-30" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeTruthy();
      expect(result.errors.sessionDate).toBeTruthy();
      expect(firstErrorField(result.errors)).toBe("title");
    }
  });
});

describe("formErrorsFromSaveErrors", () => {
  it("저장 함수의 회차 오류 키를 폼 칸 이름으로 바꾼다", () => {
    expect(
      formErrorsFromSaveErrors({
        title: "과정 이름을 입력해 주세요.",
        "sessions.0.date": "강의 날짜를 골라 주세요.",
        "sessions.0.startTime": "시작 시간을 09:30 처럼 입력해 주세요.",
        unknown: "무시",
      }),
    ).toEqual({
      title: "과정 이름을 입력해 주세요.",
      sessionDate: "강의 날짜를 골라 주세요.",
      sessionStartTime: "시작 시간을 09:30 처럼 입력해 주세요.",
    });
  });
});
