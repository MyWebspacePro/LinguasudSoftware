import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(), email: z.email().optional(),
  phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), preferredContact: z.enum(["email", "phone", "postal"]).optional(), notes: z.string().trim().max(5000).nullable().optional(), emailReminders: z.boolean().optional(), languagePreference: z.string().trim().max(60).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, context: { params: Promise<{ participantId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { participantId } = await context.params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT u.id, u.name, u.email, p.* FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id WHERE u.id = ${participantId} AND u.role = 'participant'`;
    if (!existing) return NextResponse.json({ error: "Teilnehmer wurde nicht gefunden." }, { status: 404 });
    const updated = await sql.begin(async (transaction) => {
      const [user] = await transaction`UPDATE users SET name = COALESCE(${input.name ?? null}, name), email = COALESCE(${input.email?.toLowerCase() ?? null}, email) WHERE id = ${participantId} RETURNING id, name, email, role`;
      const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
      const [profile] = await transaction`INSERT INTO participant_profiles (user_id) VALUES (${participantId}) ON CONFLICT (user_id) DO UPDATE SET phone = CASE WHEN ${has("phone")} THEN ${input.phone ?? null} ELSE participant_profiles.phone END, street = CASE WHEN ${has("street")} THEN ${input.street ?? null} ELSE participant_profiles.street END, postal_code = CASE WHEN ${has("postalCode")} THEN ${input.postalCode ?? null} ELSE participant_profiles.postal_code END, city = CASE WHEN ${has("city")} THEN ${input.city ?? null} ELSE participant_profiles.city END, preferred_contact = CASE WHEN ${has("preferredContact")} THEN ${input.preferredContact ?? null} ELSE participant_profiles.preferred_contact END, notes = CASE WHEN ${has("notes")} THEN ${input.notes ?? null} ELSE participant_profiles.notes END, email_reminders = CASE WHEN ${has("emailReminders")} THEN ${input.emailReminders ?? null} ELSE participant_profiles.email_reminders END, language_preference = CASE WHEN ${has("languagePreference")} THEN ${input.languagePreference ?? null} ELSE participant_profiles.language_preference END, updated_at = now() RETURNING *`;
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'participant', ${participantId}, 'updated', 'Teilnehmerdaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${actor.id})`;
      return { ...user, ...profile };
    });
    return NextResponse.json({ participant: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Teilnehmerdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Teilnehmerdaten konnten nicht geändert werden." }, { status: 500 });
  }
}
