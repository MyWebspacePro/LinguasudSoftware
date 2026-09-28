import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, signIn } from "@/lib/auth";

const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  try {
    const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Zugangsdaten." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");

    const user = await signIn(parsed.data.email, parsed.data.password, { ip, userAgent });
    if (!user) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError && error.code === "RATE_LIMITED") {
      return NextResponse.json({ error: "Zu viele Fehlversuche. Bitte später erneut versuchen." }, { status: 429 });
    }
    return NextResponse.json({ error: "Anmeldung ist derzeit nicht möglich." }, { status: 500 });
  }
}
