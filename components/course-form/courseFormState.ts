// 과정 만들기 폼의 값·검증 (순수 함수, tests/unit/course-form.test.ts에서 검사).
// 저장 함수(createCourse)도 같은 검증을 다시 하지만, 화면에서 먼저 막아 칸별 안내를 바로 보여준다.

import type { CourseCreateInput, SessionInput } from "@/lib/data/types";
import {
  hasErrors,
  normalizeEmail,
  validateCourseInput,
  validateSessionInput,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/domain/validation";

export interface CourseFormValues {
  title: string;
  client: string;
  description: string;
  instructorEmails: string[];
  /** 첫 강의 일정 (선택). 모두 비우면 회차 없이 만든다 */
  sessionDate: string;
  sessionStartTime: string;
  sessionLocation: string;
  sessionAudience: string;
}

export type CourseFormField = keyof CourseFormValues;

/** 오류가 난 첫 칸으로 포커스를 옮길 때 쓰는 화면 순서 */
export const FORM_FIELD_ORDER: readonly CourseFormField[] = [
  "title",
  "client",
  "description",
  "instructorEmails",
  "sessionDate",
  "sessionStartTime",
  "sessionLocation",
  "sessionAudience",
];

const SESSION_FIELD_MAP: Record<string, CourseFormField> = {
  date: "sessionDate",
  startTime: "sessionStartTime",
  location: "sessionLocation",
  audience: "sessionAudience",
};

/** 처음 열 때의 값. 만드는 사람을 담당 강사로 미리 골라 둔다 */
export function initialCourseFormValues(myEmail: string | null): CourseFormValues {
  return {
    title: "",
    client: "",
    description: "",
    instructorEmails: myEmail ? [normalizeEmail(myEmail)] : [],
    sessionDate: "",
    sessionStartTime: "",
    sessionLocation: "",
    sessionAudience: "",
  };
}

/** 첫 강의 일정 칸 중 하나라도 채웠는지 */
export function hasFirstSession(values: CourseFormValues): boolean {
  return [values.sessionDate, values.sessionStartTime, values.sessionLocation, values.sessionAudience].some(
    (value) => value.trim().length > 0,
  );
}

/** 담당 강사 선택을 켜고 끈다 (순서는 고른 순서 유지) */
export function toggleInstructor(selected: readonly string[], email: string, checked: boolean): string[] {
  const without = selected.filter((item) => item !== email);
  return checked ? [...without, email] : without;
}

/**
 * 폼 값 검증. 통과하면 createCourse에 바로 넘길 입력을 돌려준다.
 * 실패하면 칸 이름(CourseFormField)별 안내 문구를 돌려준다.
 */
export function validateCourseForm(
  values: CourseFormValues,
): ValidationResult<CourseCreateInput, CourseFormField> {
  const errors: FieldErrors<CourseFormField> = {};

  const course = validateCourseInput({
    title: values.title,
    client: values.client,
    description: values.description,
    instructorEmails: values.instructorEmails,
  });
  if (!course.ok) Object.assign(errors, course.errors);

  let session: SessionInput | null = null;
  if (hasFirstSession(values)) {
    const check = validateSessionInput({
      date: values.sessionDate,
      startTime: values.sessionStartTime,
      location: values.sessionLocation,
      audience: values.sessionAudience,
      note: "",
    });
    if (check.ok) {
      session = check.value;
    } else {
      Object.assign(errors, sessionErrorsToForm(check.errors, values));
    }
  }

  if (!course.ok || hasErrors(errors)) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...course.value,
      sessions: session ? [session] : [],
    },
  };
}

function sessionErrorsToForm(
  sessionErrors: FieldErrors,
  values: CourseFormValues,
): FieldErrors<CourseFormField> {
  const result: FieldErrors<CourseFormField> = {};
  for (const [key, message] of Object.entries(sessionErrors)) {
    const field = SESSION_FIELD_MAP[key];
    if (field && message) result[field] = message;
  }
  // 날짜 없이 시간·장소만 넣은 경우: 어떻게 하면 되는지 함께 알려 준다
  if (result.sessionDate && values.sessionDate.trim().length === 0) {
    result.sessionDate = "강의 날짜를 골라 주세요. 날짜를 아직 모르면 시간·장소·대상 칸을 비워 두면 됩니다.";
  }
  return result;
}

/**
 * 저장 함수가 돌려준 칸별 오류(예: "sessions.0.date")를 폼 칸 이름으로 바꾼다.
 * 화면 검증을 통과했다면 거의 오지 않지만, 두 검증이 어긋나도 안내가 칸 옆에 뜨게 한다.
 */
export function formErrorsFromSaveErrors(saveErrors: FieldErrors): FieldErrors<CourseFormField> {
  const result: FieldErrors<CourseFormField> = {};
  for (const [key, message] of Object.entries(saveErrors)) {
    if (!message) continue;
    if (key.startsWith("sessions.")) {
      const field = SESSION_FIELD_MAP[key.split(".")[2] ?? ""];
      if (field) result[field] = message;
      continue;
    }
    if ((FORM_FIELD_ORDER as readonly string[]).includes(key)) {
      result[key as CourseFormField] = message;
    }
  }
  return result;
}

/** 오류가 있는 첫 칸 (화면 순서 기준). 없으면 null */
export function firstErrorField(errors: FieldErrors<CourseFormField>): CourseFormField | null {
  return FORM_FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null;
}
