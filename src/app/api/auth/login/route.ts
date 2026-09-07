import { NextResponse } from "next/server";
import { z } from "zod";

import { signIn } from "@/lib/auth";

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Zugangsdaten." }, { status: 400 });
  const user = await signIn(parsed.data.email, parsed.data.password);
  if (!user) return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  return NextResponse.json({ user });
}
