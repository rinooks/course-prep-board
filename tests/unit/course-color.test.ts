import { describe, expect, it } from "vitest";
import { COURSE_COLOR_COUNT, courseColorIndex } from "@/lib/domain/courseColor";

describe("courseColorIndex", () => {
  it("같은 과정 id는 항상 같은 색", () => {
    expect(courseColorIndex("Cxxdobbxpx2tq6OTEXk7")).toBe(courseColorIndex("Cxxdobbxpx2tq6OTEXk7"));
  });

  it("0 ~ 5 사이 값이고, 여러 과정에 고르게 나뉜다", () => {
    const used = new Set<number>();
    for (let index = 0; index < 60; index += 1) {
      const value = courseColorIndex(`course-${index}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(COURSE_COLOR_COUNT);
      used.add(value);
    }
    expect(used.size).toBe(COURSE_COLOR_COUNT);
  });
});
