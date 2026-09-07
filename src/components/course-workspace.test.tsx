import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CourseWorkspace } from "./course-workspace";

describe("CourseWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves selected weekdays with an individual start time per day", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/courses" && init?.method === "POST") return { ok: true, json: async () => ({ course: { id: "course-1" } }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [] }) };
      if (url === "/api/users?role=teacher") return { ok: true, json: async () => ({ users: [{ id: "teacher-1", name: "Mia Muster" }] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "room-1", name: "A1", location_name: "Schaffhausen" }] }) };
      if (url === "/api/course-schedules") return { ok: true, json: async () => ({ schedules: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseWorkspace />);

    await screen.findByText("Noch keine Kurse angelegt.");
    fireEvent.click(screen.getByRole("button", { name: /Kurs anlegen/ }));
    fireEvent.change(screen.getByLabelText("Kurskennung"), { target: { value: "MARKELDEA201" } });
    fireEvent.change(screen.getByLabelText("Sprache"), { target: { value: "Deutsch" } });
    fireEvent.change(screen.getByLabelText("Lehrperson"), { target: { value: "teacher-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Di" }));
    fireEvent.change(screen.getByLabelText("Dienstag Startzeit"), { target: { value: "19:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Kurs speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses", expect.objectContaining({ method: "POST" })));
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/courses" && init?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      code: "MARKELDEA201",
      schedules: [
        { weekday: 0, startTime: "18:00", durationMinutes: 90 },
        { weekday: 1, startTime: "19:15", durationMinutes: 90 },
      ],
    });
  });
});
