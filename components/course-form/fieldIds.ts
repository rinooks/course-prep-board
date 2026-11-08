// 폼 칸 id. 오류가 난 칸으로 포커스를 옮길 때도 같은 id를 쓴다.

import type { CourseFormField } from "./courseFormState";

export type CourseFormFieldIds = Record<CourseFormField, string>;

/** prefix: 한 화면에 폼이 둘이어도 id가 겹치지 않게 앞에 붙이는 글자 */
export function courseFormFieldIds(prefix: string): CourseFormFieldIds {
  return {
    title: `${prefix}-title`,
    client: `${prefix}-client`,
    description: `${prefix}-description`,
    instructorEmails: `${prefix}-instructors`,
    sessionDate: `${prefix}-session-date`,
    sessionStartTime: `${prefix}-session-time`,
    sessionLocation: `${prefix}-session-location`,
    sessionAudience: `${prefix}-session-audience`,
  };
}
