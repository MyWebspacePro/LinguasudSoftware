import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardOverview } from "./dashboard-overview";

describe("DashboardOverview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads all dashboard KPIs from the administration APIs in parallel", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      switch (String(input)) {
        case "/api/courses": return { ok: true, json: async () => ({ courses: [{ id: "course-1", status: "active" }, { id: "course-2", status: "planned" }, { id: "course-3", status: "completed" }] }) };
        case "/api/users?role=participant": return { ok: true, json: async () => ({ users: [{ id: "participant-1" }, { id: "participant-2" }] }) };
        case "/api/rooms": return { ok: true, json: async () => ({ rooms: [{ id: "room-1" }, { id: "room-2" }, { id: "room-3" }] }) };
        case "/api/billing/overview": return { ok: true, json: async () => ({ enrollments: [{ enrollment_id: "enrollment-1", billing_type: "private", lowCredit: true, billableConfirmedLessons: 0 }, { enrollment_id: "enrollment-2", billing_type: "authority", lowCredit: false, billableConfirmedLessons: 4 }] }) };
        default: return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardOverview />);

    expect(await screen.findByLabelText("Laufende Kurse: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Teilnehmer: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Aktive Räume: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Guthaben niedrig: 1")).toBeInTheDocument();
    expect(screen.getByText("4 bestätigte Lektionen für Kostenträger")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock).toHaveBeenCalledWith("/api/courses", expect.objectContaining({ credentials: "same-origin" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/users?role=participant", expect.objectContaining({ credentials: "same-origin" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/rooms", expect.objectContaining({ credentials: "same-origin" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/overview", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("shows a retryable error instead of dashboard demo values", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Nicht berechtigt." }) })));

    render(<DashboardOverview />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Nicht berechtigt.");
    expect(screen.queryByLabelText(/Laufende Kurse:/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();
  });
});
