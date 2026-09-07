import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleWorkspace } from "./role-workspaces";

describe("RoleWorkspace attendance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads attendance for the teacher lesson and persists the selected statuses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lessons: [{
            id: "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9",
            code: "MARKELDEA201",
            language: "Deutsch",
            level: "A2",
            starts_at: "2026-09-07T16:00:00.000Z",
            duration_minutes: 90,
            room_name: "A1",
            location_name: "Schaffhausen 1",
            status: "scheduled",
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          attendance: [
            { enrollment_id: "9fdbf5d8-d717-4a11-8368-d019a4a53e7a", participant_name: "Lea Baumann", status: "present" },
            { enrollment_id: "3e77aae7-ec0a-4ddd-8bba-f04b48f1f54b", participant_name: "Amir Hussein", status: "excused" },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ attendance: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const onNotice = vi.fn();

    render(<RoleWorkspace role="teacher" onNotice={onNotice} />);
    fireEvent.click(screen.getByRole("button", { name: "Anwesenheit erfassen" }));

    expect(await screen.findByLabelText("Lea Baumann Anwesenheit")).toHaveValue("present");
    expect(screen.getByLabelText("Amir Hussein Anwesenheit")).toHaveValue("excused");

    fireEvent.change(screen.getByLabelText("Lea Baumann Anwesenheit"), { target: { value: "online" } });
    fireEvent.click(screen.getByRole("button", { name: "Anwesenheit bestätigen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/attendance", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        lessonId: "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9",
        entries: [
          { enrollmentId: "9fdbf5d8-d717-4a11-8368-d019a4a53e7a", status: "online" },
          { enrollmentId: "3e77aae7-ec0a-4ddd-8bba-f04b48f1f54b", status: "excused" },
        ],
      }),
    }));
    expect(onNotice).toHaveBeenCalledWith("Anwesenheit gespeichert. 2 Abwesenheiten wird dem Büro angezeigt.");
  });

  it("shows the API error and does not pretend that attendance was saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Nicht berechtigt." }) });
    vi.stubGlobal("fetch", fetchMock);
    const onNotice = vi.fn();

    render(<RoleWorkspace role="teacher" onNotice={onNotice} />);
    fireEvent.click(screen.getByRole("button", { name: "Anwesenheit erfassen" }));

    expect(await screen.findByText("Nicht berechtigt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anwesenheit bestätigen" })).toBeDisabled();
    expect(onNotice).not.toHaveBeenCalled();
  });

  it("stores lesson documentation on the concrete lesson", async () => {
    const lessonId = "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/lessons?date=")) return {
        ok: true,
        json: async () => ({ lessons: [{ id: lessonId, code: "MARKELDEA201", language: "Deutsch", level: "A2", starts_at: "2026-09-07T16:00:00.000Z", duration_minutes: 90, room_name: "A1", location_name: "Schaffhausen 1", status: "scheduled" }] }),
      };
      if (url === `/api/lessons/${lessonId}` && init?.method === "PATCH") return { ok: true, json: async () => ({ lesson: { id: lessonId } }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const onNotice = vi.fn();

    render(<RoleWorkspace role="teacher" onNotice={onNotice} />);
    await screen.findByText(/MARKELDEA201/);
    fireEvent.click(screen.getByRole("button", { name: /Lektionsdokumentation öffnen/ }));
    fireEvent.change(screen.getByLabelText("Unterrichtsinhalt"), { target: { value: "Dialoge zum Arztbesuch geübt." } });
    fireEvent.change(screen.getByLabelText("Hausaufgaben"), { target: { value: "Arbeitsblatt 3 fertigstellen." } });
    fireEvent.click(screen.getByRole("button", { name: "Dokumentation speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/lessons/${lessonId}`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ lessonContent: "Dialoge zum Arztbesuch geübt.", homework: "Arbeitsblatt 3 fertigstellen.", teacherNotes: null }),
    })));
    expect(onNotice).toHaveBeenCalledWith("MARKELDEA201: Lektionsdokumentation gespeichert.");
  });
});
