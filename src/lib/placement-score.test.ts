import { describe, expect, it } from "vitest";

import { orientationLevel } from "@/lib/placement-score";

describe("unverbindliche Deutsch-Einstufung", () => {
  it.each([
    [0, "A1"], [2, "A1"], [3, "A2"], [4, "A2"],
    [5, "B1"], [6, "B1"], [7, "B2"], [8, "B2"],
  ] as const)("stuft %i richtige Antworten höchstens als %s ein", (score, expected) => {
    expect(orientationLevel(score)).toBe(expected);
  });
});
