import { z } from "zod";

/**
 * The levels offered by Linguasud. Full CEFR levels remain available for
 * courses that do not use an internal subdivision; the .1/.2 variants allow
 * the office to represent the common two-part course progression precisely.
 */
export const COURSE_LEVELS = [
  "A0",
  "A1.1",
  "A1.2",
  "A1",
  "A2.1",
  "A2.2",
  "A2",
  "B1.1",
  "B1.2",
  "B1",
  "B2.1",
  "B2.2",
  "B2",
  "B2+",
  "C1.1",
  "C1.2",
  "C1",
  "C1+",
  "C2.1",
  "C2.2",
  "C2",
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const courseLevelSchema = z.enum(COURSE_LEVELS);
