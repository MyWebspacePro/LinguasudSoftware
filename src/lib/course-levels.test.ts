import { describe, expect, it } from "vitest";

import { COURSE_LEVELS, courseLevelSchema } from "./course-levels";

describe("course levels", () => {
  it("offers the complete CEFR range and common internal subdivisions", () => {
    expect(COURSE_LEVELS).toEqual(expect.arrayContaining(["A0", "A1.1", "A1.2", "A2.1", "B1.2", "B2+", "C1+", "C2"]));
  });

  it("rejects values that are not an offered course level", () => {
    expect(courseLevelSchema.safeParse("B2.1").success).toBe(true);
    expect(courseLevelSchema.safeParse("C3").success).toBe(false);
  });
});
