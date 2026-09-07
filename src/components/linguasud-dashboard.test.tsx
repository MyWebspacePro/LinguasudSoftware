import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LinguasudDashboard } from "./linguasud-dashboard";

describe("LinguasudDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the daily room plan and lesson cards", () => {
    render(<LinguasudDashboard />);

    expect(screen.getByRole("heading", { name: "Raumplan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MARKELDEA201/ })).toBeInTheDocument();
    expect(screen.getByText("Schaffhausen 1")).toBeInTheDocument();
    expect(screen.getByText("Winterthur")).toBeInTheDocument();
  });

  it("opens lesson details and persists cancellation of a concrete lesson", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/api/lessons/lesson-markel-a2")
      ? { ok: true, json: async () => ({ lesson: { status: "cancelled" } }) }
      : { ok: false, json: async () => ({ error: "Nicht angemeldet." }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<LinguasudDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /MARKELDEA201/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lektion absagen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/lessons/lesson-markel-a2", expect.objectContaining({ method: "PATCH" })));
  });

  it("provides the courses workspace", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [] }) };
      if (url === "/api/users?role=teacher") return { ok: true, json: async () => ({ users: [] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [] }) };
      if (url === "/api/course-schedules") return { ok: true, json: async () => ({ schedules: [] }) };
      return { ok: false, json: async () => ({ error: "Nicht angemeldet." }) };
    }));
    render(<LinguasudDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Kurse" }));
    expect(await screen.findByRole("heading", { level: 2, name: /Kurse/ })).toBeInTheDocument();
  });
});
