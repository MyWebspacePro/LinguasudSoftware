import "server-only";

import { z } from "zod";

import { CONSENT_COPY, LOCALES } from "@/lib/public-site";
import { orientationLevel } from "@/lib/placement-score";
import type { PlacementRecord } from "@/lib/public-site";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { HttpError, notFound } from "@/server/http";
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
    const [test] = await tx<{ id: string }[]>`
      INSERT INTO placement_tests (language, result_level, first_name, last_name, email, phone, answers, consent_at, consent_text)
      VALUES ('Deutsch', ${level}, ${input.firstName}, ${input.lastName}, ${input.email},
              ${input.phone ?? null},
              ${JSON.stringify({ answers: input.answers, correct, total: questions.length, provisional: true })}::jsonb,
              now(), ${CONSENT_COPY[input.locale]})
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

export async function listPlacementResults(): Promise<PlacementRecord[]> {
  const rows = await db()<{
    id: string; first_name: string; last_name: string; email: string;
    result_level: string | null; participant_id: string | null; created_at: Date;
  }[]>`
    SELECT id, first_name, last_name, email, result_level, participant_id, created_at
    FROM placement_tests ORDER BY created_at DESC LIMIT 200
  `;
  return rows.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name,
    email: row.email, resultLevel: row.result_level, participantId: row.participant_id,
    createdAt: row.created_at.toISOString() }));
}

export const placementAssignmentSchema = z.object({ participantId: z.uuid() });

export async function assignPlacement(id: string, participantId: string, actorId: string) {
  return db().begin(async (tx) => {
    const [before] = await tx<{ id: string; participant_id: string | null }[]>`
      SELECT id, participant_id FROM placement_tests WHERE id = ${id} FOR UPDATE
    `;
    if (!before) throw notFound("Test wurde nicht gefunden.");
    const [person] = await tx<{ id: string }[]>`
      SELECT users.id FROM users JOIN user_roles ON user_roles.user_id = users.id
      WHERE users.id = ${participantId} AND user_roles.role = 'participant'
    `;
    if (!person) throw notFound("Teilnehmende Person wurde nicht gefunden.");
    await tx`UPDATE placement_tests SET participant_id = ${person.id} WHERE id = ${id}`;
    await recordChange(tx, { entityType: "placement_test", entityId: id, eventType: "assigned", summary: "Einstufung einer Person zugeordnet", before, after: { participantId: person.id }, actorId });
    return { id, participantId: person.id };
  });
}
