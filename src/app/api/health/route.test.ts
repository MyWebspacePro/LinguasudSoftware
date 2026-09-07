import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database", () => ({ db: vi.fn() }));

import { db } from "@/lib/database";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("is ready only when PostgreSQL responds", async () => {
    const query = vi.fn().mockResolvedValue([{ healthy: 1 }]);
    vi.mocked(db).mockReturnValue(query as never);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns service unavailable when PostgreSQL cannot be reached", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.mocked(db).mockReturnValue(query as never);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
