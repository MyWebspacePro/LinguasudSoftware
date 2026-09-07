import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardNotifications } from "./dashboard-notifications";

describe("DashboardNotifications", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps an open task visible until the office marks it done", async () => {
    const task = {
      id: "4f69f3a9-6a9e-4e77-90a6-c2c6a4cd62c0",
      task_type: "course_level_changed",
      title: "Kursniveau prüfen",
      description: "Mia Muster hat DEUA101 von A1 auf A2 geändert. Kursbezeichnung/Kurskennung im Büro prüfen.",
      created_at: "2026-09-01T09:00:00.000Z",
      course_id: "course-1",
      course_code: "DEUA101",
      language: "Deutsch",
      level: "A2",
      actor_name: "Mia Muster",
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return { ok: true, json: async () => ({ task: { ...task, status: "done" } }) };
      return { ok: true, json: async () => ({ tasks: [task] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DashboardNotifications />);

    expect(await screen.findByText("Kursniveau prüfen")).toBeInTheDocument();
    expect(screen.getByText(/Kursbezeichnung\/Kurskennung/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erledigt" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/notifications", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByText("Keine offenen Aufgaben.")).toBeInTheDocument();
  });

  it("opens the attendance review on the lesson date for an excuse task", async () => {
    const onOpenAttendance = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ tasks: [{ id: "4f69f3a9-6a9e-4e77-90a6-c2c6a4cd62c0", task_type: "attendance_excuse_review", title: "Entschuldigungen prüfen", description: "Eine gemeldete Entschuldigung prüfen.", created_at: "2026-09-01T09:00:00.000Z", course_id: "course-1", course_code: "DEUA101", language: "Deutsch", level: "A1", actor_name: "Mia Muster", lesson_id: "00a24f1a-7d8f-4253-b302-4371a6cd507e", lesson_date: "2026-09-07" }] }) })));
    render(<DashboardNotifications onOpenAttendance={onOpenAttendance} />);

    fireEvent.click(await screen.findByRole("button", { name: "Prüfen" }));
    expect(onOpenAttendance).toHaveBeenCalledWith("2026-09-07");
  });

  it("shows a retryable error when office tasks cannot be loaded", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, json: async () => ({ error: "Nicht berechtigt." }) }
        : { ok: true, json: async () => ({ tasks: [] }) };
    }));
    render(<DashboardNotifications />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Nicht berechtigt.");
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));

    expect(await screen.findByText("Keine offenen Aufgaben.")).toBeInTheDocument();
  });
});
