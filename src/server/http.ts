import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError } from "@/lib/auth";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const notFound = (message = "Nicht gefunden.") => new HttpError(404, message);
export const badRequest = (message: string) => new HttpError(400, message);
export const conflict = (message: string) => new HttpError(409, message);

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export type RouteBody = { status?: number; body: unknown };

/**
 * Uniform API wrapper: maps auth errors, validation errors and known HTTP
 * errors to consistent JSON responses and never leaks internal details.
 */
export async function jsonRoute(handler: () => Promise<RouteBody>): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json(result.body, { status: result.status ?? 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "RATE_LIMITED") return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
      if (error.code === "FORBIDDEN") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingaben.", issues: error.issues }, { status: 400 });
    }
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Der Datensatz existiert bereits." }, { status: 409 });
    }
    console.error("[api]", error);
    return NextResponse.json({ error: "Unerwarteter Fehler." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => {
    throw badRequest("Ungültiger Anfrage-Body.");
  });
}
