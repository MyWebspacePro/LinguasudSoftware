import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PeopleWorkspace } from "./people-workspace";

describe("PeopleWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a participant account and submits a course enrollment", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/participants" && init?.method === "POST") return { ok: true, json: async () => ({ participant: { id: "participant-2" } }) };
      if (url === "/api/enrollments" && init?.method === "POST") return { ok: true, json: async () => ({ enrollment: { id: "enrollment-1" } }) };
      if (url === "/api/participants") return { ok: true, json: async () => ({ participants: [{ id: "participant-1", name: "Lea Baumann", email: "lea@example.test", role: "participant" }] }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [{ id: "course-1", code: "DEUA101", language: "Deutsch", level: "A1", teacher_name: "Mia Muster" }] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PeopleWorkspace mode="participants" />);

    await screen.findByText("Lea Baumann");
    fireEvent.click(screen.getByRole("button", { name: /Teilnehmer anlegen/ }));
    fireEvent.change(screen.getByLabelText("Vorname"), { target: { value: "Mira" } });
    fireEvent.change(screen.getByLabelText("Nachname"), { target: { value: "Frei" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "mira@example.test" } });
    fireEvent.change(screen.getByLabelText("Startpasswort"), { target: { value: "SicheresPasswort12" } });
    fireEvent.click(screen.getByRole("button", { name: "Zugang anlegen" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/participants", expect.objectContaining({ method: "POST" })));

    fireEvent.click(screen.getByRole("button", { name: /In Kurs einschreiben/ }));
    fireEvent.change(screen.getByLabelText("Teilnehmer"), { target: { value: "participant-1" } });
    fireEvent.change(screen.getByLabelText("Kurs"), { target: { value: "course-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Einschreiben" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/enrollments", expect.objectContaining({ method: "POST" })));
    const enrollmentCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/enrollments" && init?.method === "POST");
    expect(JSON.parse(String(enrollmentCall?.[1]?.body))).toMatchObject({ participantId: "participant-1", courseId: "course-1", billingType: "private", creditLessons: 14 });
  });

  it("shows attendance on the participant and records a course pause", async () => {
    const enrollment = {
      id: "enrollment-1",
      participant_id: "participant-1",
      course_id: "course-1",
      billing_type: "private",
      credit_lessons: 14,
      active: true,
      course_code: "DEUA101",
      course_language: "Deutsch",
      course_level: "A1",
      attendance_summary: { present: 3, excused: 1, unexcused: 0, online: 0, trial: 0 },
      pauses: [],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/participants") return { ok: true, json: async () => ({ participants: [{ id: "participant-1", name: "Lea Baumann", email: "lea@example.test", role: "participant" }] }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [] }) };
      if (url === "/api/enrollments" && init?.method === "POST") return { ok: true, json: async () => ({ enrollment }) };
      if (url === "/api/enrollments/enrollment-1/pauses" && init?.method === "POST") return { ok: true, json: async () => ({ pause: { id: "pause-1" } }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [enrollment] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PeopleWorkspace mode="participants" />);

    await screen.findByText("Lea Baumann");
    expect(screen.getByText("3 anwesend · 1 entschuldigt · 0 unentschuldigt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause erfassen" }));
    fireEvent.change(screen.getByLabelText("Pause von"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Pause bis"), { target: { value: "2026-09-20" } });
    fireEvent.change(screen.getByLabelText("Grund / Hinweis"), { target: { value: "Ferien" } });
    fireEvent.click(screen.getByRole("button", { name: "Pause speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/enrollments/enrollment-1/pauses", expect.objectContaining({ method: "POST" })));
    const pauseCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/enrollments/enrollment-1/pauses" && init?.method === "POST");
    expect(JSON.parse(String(pauseCall?.[1]?.body))).toEqual({ startsOn: "2026-09-10", endsOn: "2026-09-20", reason: "Ferien" });
  });

  it("submits teacher qualifications as structured language ranges", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/teachers" && init?.method === "POST") return { ok: true, json: async () => ({ teacher: { id: "teacher-2" } }) };
      if (url === "/api/teachers") return { ok: true, json: async () => ({ teachers: [] }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PeopleWorkspace mode="teachers" />);

    fireEvent.click(await screen.findByRole("button", { name: /Lehrperson anlegen/ }));
    fireEvent.change(screen.getByLabelText("Vorname"), { target: { value: "Mia" } });
    fireEvent.change(screen.getByLabelText("Nachname"), { target: { value: "Muster" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "mia@example.test" } });
    fireEvent.change(screen.getByLabelText("1. Sprache"), { target: { value: "Deutsch" } });
    fireEvent.change(screen.getByLabelText("1. Niveau von"), { target: { value: "A1" } });
    fireEvent.change(screen.getByLabelText("1. Niveau bis"), { target: { value: "C1" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Sprache hinzufügen" }));
    fireEvent.change(screen.getByLabelText("2. Sprache"), { target: { value: "Englisch" } });
    fireEvent.change(screen.getByLabelText("2. Niveau von"), { target: { value: "B1" } });
    fireEvent.change(screen.getByLabelText("2. Niveau bis"), { target: { value: "B2" } });
    fireEvent.change(screen.getByLabelText("Startpasswort"), { target: { value: "SicheresPasswort12" } });
    fireEvent.click(screen.getByRole("button", { name: "Zugang anlegen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/teachers", expect.objectContaining({ method: "POST" })));
    const teacherCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/teachers" && init?.method === "POST");
    expect(JSON.parse(String(teacherCall?.[1]?.body))).toMatchObject({ firstName: "Mia", lastName: "Muster", teachingLevels: [{ language: "Deutsch", fromLevel: "A1", toLevel: "C1" }, { language: "Englisch", fromLevel: "B1", toLevel: "B2" }] });
  });

  it("lets the office set a replacement password from a person's master data", async () => {
    const participant = { id: "participant-1", name: "Lea Baumann", first_name: "Lea", last_name: "Baumann", email: "lea@example.test", role: "participant" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/participants/participant-1" && init?.method === "PATCH") return { ok: true, json: async () => ({ participant }) };
      if (url === "/api/participants") return { ok: true, json: async () => ({ participants: [participant] }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PeopleWorkspace mode="participants" />);

    await screen.findByText("Lea Baumann");
    fireEvent.click(screen.getByRole("button", { name: "Stammdaten bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Neues Passwort (optional)"), { target: { value: "NeuesSicheresPasswort12" } });
    fireEvent.click(screen.getByRole("button", { name: "Daten speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/participants/participant-1", expect.objectContaining({ method: "PATCH" })));
    const updateCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/participants/participant-1" && init?.method === "PATCH");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ password: "NeuesSicheresPasswort12" });
  });
});
