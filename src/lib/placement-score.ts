/** Initial orientation for an eight-question short check, never a certified CEFR assessment. */
export function orientationLevel(correct: number): "A1" | "A2" | "B1" | "B2" {
  if (correct >= 7) return "B2";
  if (correct >= 5) return "B1";
  if (correct >= 3) return "A2";
  return "A1";
}
