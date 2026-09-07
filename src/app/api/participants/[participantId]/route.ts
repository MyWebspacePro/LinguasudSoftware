import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(), email: z.email().optional(),
  phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), dateOfBirth: z.string().date().nullable().optional(), preferredContact: z.enum(["email", "phone", "postal"]).optional(), emergencyName: z.string().trim().max(120).nullable().optional(), emergencyPhone: z.string().trim().max(40).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), emailReminders: z.boolean().optional(), languagePreference: z.string().trim().max(60).nullable().optional(),
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
      const [profile] = await transaction`INSERT INTO participant_profiles (user_id) VALUES (${participantId}) ON CONFLICT (user_id) DO UPDATE SET phone = COALESCE(${input.phone ?? null}, participant_profiles.phone), street = COALESCE(${input.street ?? null}, participant_profiles.street), postal_code = COALESCE(${input.postalCode ?? null}, participant_profiles.postal_code), city = COALESCE(${input.city ?? null}, participant_profiles.city), date_of_birth = COALESCE(${input.dateOfBirth ?? null}, participant_profiles.date_of_birth), preferred_contact = COALESCE(${input.preferredContact ?? null}, participant_profiles.preferred_contact), emergency_name = COALESCE(${input.emergencyName ?? null}, participant_profiles.emergency_name), emergency_phone = COALESCE(${input.emergencyPhone ?? null}, participant_profiles.emergency_phone), notes = COALESCE(${input.notes ?? null}, participant_profiles.notes), email_reminders = COALESCE(${input.emailReminders ?? null}, participant_profiles.email_reminders), language_preference = COALESCE(${input.languagePreference ?? null}, participant_profiles.language_preference), updated_at = now() RETURNING *`;
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
