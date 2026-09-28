import "server-only";

import { z } from "zod";

import { LOCALES } from "@/lib/public-site";
import { db } from "@/server/db";
import { HttpError } from "@/server/http";
import { notifyRoles } from "@/server/services/notifications";
import { recordPublicSubmission } from "@/server/services/public-submissions";

export type PlacementQuestion = { id: string; prompt: string; options: string[] };

type QuestionRow = PlacementQuestion & { correct_option: number };

export async function listPlacementQuestions(): Promise<PlacementQuestion[]> {
  return db()<PlacementQuestion[]>`
    SELECT id, prompt, options FROM placement_questions WHERE active = true ORDER BY sort_order
  `;
}

export const placementSubmissionSchema = z.object({
  locale: z.enum(LOCALES),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().max(60).optional(),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
  answers: z.array(z.object({ questionId: z.uuid(), option: z.number().int().min(0).max(2) })).min(1).max(30),
});

/** Orientation only. A member of staff confirms the final course level. */
export function orientationLevel(correct: number): "A1" | "A2" | "B1" | "B2" {
  if (correct >= 7) return "B2";
  if (correct >= 5) return "B1";
  if (correct >= 3) return "A2";
  return "A1";
}

export async function submitPlacement(input: z.infer<typeof placementSubmissionSchema>, ip: string | null) {
  return db().begin(async (tx) => {
    await recordPublicSubmission(tx, "placement", input.email, ip);
    const questions = await tx<QuestionRow[]>`
      SELECT id, prompt, options, correct_option FROM placement_questions WHERE active = true ORDER BY sort_order
    `;
    const answers = new Map(input.answers.map((answer) => [answer.questionId, answer.option]));
    if (questions.length < 8 || answers.size !== questions.length ||
        questions.some((question) => !answers.has(question.id))) {
      throw new HttpError(400, "Bitte alle aktuellen Fragen genau einmal beantworten.");
    }
    const correct = questions.filter((question) => answers.get(question.id) === question.correct_option).length;
    const level = orientationLevel(correct);
    const [person] = await tx<{ id: string }[]>`
      SELECT id FROM users WHERE lower(email) = ${input.email} LIMIT 1
    `;
    const [test] = await tx<{ id: string }[]>`
      INSERT INTO placement_tests (language, result_level, first_name, last_name, email, phone, participant_id, answers)
      VALUES ('Deutsch', ${level}, ${input.firstName}, ${input.lastName}, ${input.email},
              ${input.phone ?? null}, ${person?.id ?? null},
              ${JSON.stringify({ answers: input.answers, correct, total: questions.length, provisional: true })}::jsonb)
      RETURNING id
    `;
    const [task] = await tx<{ id: string }[]>`
      INSERT INTO tasks (title, description, priority)
      VALUES (${`Deutsch-Einstufung: ${input.firstName} ${input.lastName}`},
              ${`Unverbindliche Orientierung: ${level} (${correct}/${questions.length}) · ${input.email} · Beratung erforderlich`}, 'normal')
      RETURNING id
    `;
    await tx`INSERT INTO task_links (task_id, entity_type, entity_id) VALUES (${task.id}, 'placement_test', ${test.id})`;
    await notifyRoles(tx, ["office", "admin"], {
      kind: "placement_test", title: "Neuer Deutsch-Einstufungstest", body: `${input.firstName} ${input.lastName} · Orientierung ${level}`,
      entityType: "placement_test", entityId: test.id,
    });
    return { id: test.id, level, provisional: true };
  });
}
