import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Sitzung konnte nicht geprüft werden." }, { status: 500 });
  }
}
