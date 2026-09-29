import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import { z } from "zod";

import { addPersonNote, getParticipantRecord, getPerson, personUpdateSchema, updatePerson } from "@/server/services/people";

export async function GET(request: Request, context: { params: Promise<{ personId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { personId } = await context.params;
    if (new URL(request.url).searchParams.get("record") === "participant") {
      return { body: { record: await getParticipantRecord(personId) } };
    }
    const person = await getPerson(personId);
    if (!person) throw notFound("Person wurde nicht gefunden.");
    return { body: { person } };
  });
}

export async function POST(request: Request, context: { params: Promise<{ personId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { personId } = await context.params;
    const { body } = z.object({ body: z.string().trim().min(1).max(5000) }).parse(await readJson(request));
    return { status: 201, body: { note: await addPersonNote(actor, personId, body) } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ personId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { personId } = await context.params;
    const patch = personUpdateSchema.parse(await readJson(request));
    return { body: { person: await updatePerson(actor, personId, patch) } };
  });
}
