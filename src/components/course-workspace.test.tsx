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
      if (url === "/api/teachers") return { ok: true, json: async () => ({ teachers: [{ id: "teacher-1", name: "Mia Muster", teaching_levels: [{ language: "Deutsch", levels: ["A1"] }] }] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "room-1", name: "A1", location_name: "Schaffhausen" }] }) };
      if (url === "/api/course-schedules") return { ok: true, json: async () => ({ schedules: [] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseWorkspace />);

    await screen.findByText("Noch keine Kurse angelegt.");
    fireEvent.click(screen.getByRole("button", { name: /Kurs anlegen/ }));
    fireEvent.change(screen.getByLabelText("Kurskennung"), { target: { value: "MARKELDEA201" } });
    fireEvent.change(screen.getByLabelText("Sprache"), { target: { value: "Deutsch" } });
    fireEvent.change(screen.getByLabelText("Lehrperson"), { target: { value: "teacher-1" } });
    fireEvent.change(screen.getByLabelText("Standardraum"), { target: { value: "room-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Di" }));
    fireEvent.change(screen.getByLabelText("Dienstag Startzeit"), { target: { value: "19:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Kurs speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses", expect.objectContaining({ method: "POST" })));
    const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/courses" && init?.method === "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      code: "MARKELDEA201",
      standardRoomId: "room-1",
      schedules: [
        { weekday: 0, startTime: "18:00" },
        { weekday: 1, startTime: "19:15" },
      ],
    });
  });

  it("updates course details and manages existing weekly appointments", async () => {
    const course = { id: "course-1", code: "DEUA101", language: "Deutsch", level: "A1", duration_minutes: 90, status: "active", teacher_name: "Mia Muster" };
    const schedule = { id: "schedule-1", course_id: "course-1", weekday: 0, start_time: "18:00:00", duration_minutes: 90 };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/courses/course-1" && init?.method === "PATCH") return { ok: true, json: async () => ({ course }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [course] }) };
      if (url === "/api/teachers") return { ok: true, json: async () => ({ teachers: [{ id: "teacher-1", name: "Mia Muster", teaching_levels: [{ language: "Deutsch", levels: ["A1"] }] }] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "room-1", name: "A1", location_name: "Schaffhausen" }] }) };
      if (url === "/api/course-schedules" && init?.method === "PUT") return { ok: true, json: async () => ({ schedule }) };
      if (url === "/api/course-schedules" && init?.method === "POST") return { ok: true, json: async () => ({ schedule: { ...schedule, id: "schedule-2" } }) };
      if (url === "/api/course-schedules" && init?.method === "DELETE") return { ok: true, json: async () => ({}) };
      if (url === "/api/course-schedules") return { ok: true, json: async () => ({ schedules: [schedule] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CourseWorkspace />);

    await screen.findByRole("heading", { name: "DEUA101" });
    fireEvent.click(screen.getByRole("button", { name: "Kurs bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Kurskennung bearbeiten"), { target: { value: "DEUA102" } });
    fireEvent.change(screen.getByLabelText("Niveau bearbeiten"), { target: { value: "A1.2" } });
    fireEvent.change(screen.getByLabelText("Kursstatus"), { target: { value: "paused" } });
    fireEvent.click(screen.getByRole("button", { name: "Kursdaten speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/courses/course-1", expect.objectContaining({ method: "PATCH" })));
    const courseUpdate = fetchMock.mock.calls.find(([url, init]) => url === "/api/courses/course-1" && init?.method === "PATCH");
    expect(JSON.parse(String(courseUpdate?.[1]?.body))).toEqual({ code: "DEUA102", level: "A1.2", status: "paused" });

    await screen.findByRole("button", { name: "Kurs bearbeiten" });
    fireEvent.click(screen.getByRole("button", { name: "Kurs bearbeiten" }));
    fireEvent.change(screen.getByLabelText("schedule-1 Startzeit"), { target: { value: "19:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Termin speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/course-schedules", expect.objectContaining({ method: "PUT" })));
    const scheduleUpdate = fetchMock.mock.calls.find(([url, init]) => url === "/api/course-schedules" && init?.method === "PUT");
    expect(JSON.parse(String(scheduleUpdate?.[1]?.body))).toEqual({ id: "schedule-1", courseId: "course-1", weekday: 0, startTime: "19:15" });

    fireEvent.change(screen.getByLabelText("Neue Startzeit"), { target: { value: "20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Termin hinzufügen" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/course-schedules", expect.objectContaining({ method: "POST" })));

    fireEvent.click(screen.getByRole("button", { name: "Termin löschen" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/course-schedules", expect.objectContaining({ method: "DELETE" })));
  });

  it("shows the course roster and ends an active participation", async () => {
    const course = { id: "course-1", code: "DEUA101", language: "Deutsch", level: "A1", duration_minutes: 90, status: "active", teacher_name: "Mia Muster" };
    const enrollment = { id: "enrollment-1", course_id: "course-1", participant_name: "Lea Baumann", participant_email: "lea@example.test", active: true };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [course] }) };
      if (url === "/api/teachers") return { ok: true, json: async () => ({ teachers: [] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [] }) };
      if (url === "/api/course-schedules") return { ok: true, json: async () => ({ schedules: [] }) };
      if (url === "/api/enrollments" && !init?.method) return { ok: true, json: async () => ({ enrollments: [enrollment] }) };
      if (url === "/api/enrollments/enrollment-1" && init?.method === "DELETE") return { ok: true, json: async () => ({ enrollment: { ...enrollment, active: false } }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<CourseWorkspace focusCourseId="course-1" />);

    await screen.findByRole("heading", { name: "Teilnehmende in DEUA101" });
    expect(screen.getByText("Lea Baumann")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Teilnahme beenden" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/enrollments/enrollment-1", expect.objectContaining({ method: "DELETE" })));
    expect(screen.getByText("Teilnahme beendet")).toBeInTheDocument();
  });
});
