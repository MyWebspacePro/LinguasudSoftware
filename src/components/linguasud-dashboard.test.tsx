import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LinguasudDashboard } from "./linguasud-dashboard";

describe("LinguasudDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function plannerFetch(lessonId = "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9") {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", name: "A1", capacity: 10, location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", location_name: "Schaffhausen 1" }, { id: "6e6384e0-5912-4ea4-9117-cf42408a6d75", name: "Kursraum 1", capacity: 10, location_id: "2f1f579f-e763-4ab0-ae48-faf926a4965a", location_name: "Winterthur" }] }) };
      if (url.startsWith("/api/lessons?date=")) {
        const date = new URL(url, "https://linguasud.test").searchParams.get("date") ?? "2026-09-07";
        return { ok: true, json: async () => ({ lessons: [{ id: lessonId, code: "MARKELDEA201", language: "Deutsch", level: "A2", room_id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", teacher_id: "415b4286-8f23-433a-bf9b-ca205d7d7782", teacher_name: "Maria Keller", starts_at: `${date}T18:00:00.000Z`, duration_minutes: 90, participant_count: 5, status: "scheduled", standard_location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", standard_location_name: "Schaffhausen 1" }] }) };
      }
      return { ok: false, json: async () => ({ error: "Nicht angemeldet." }) };
    });
  }

  it("shows the daily room plan and lesson cards", async () => {
    vi.stubGlobal("fetch", plannerFetch());
    render(<LinguasudDashboard />);

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    ["Dashboard", "Teilnehmer", "Lehrpersonen", "Kurse", "Räume", "Abrechnung"].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: /MARKELDEA201/ })).toBeInTheDocument();
    expect(screen.getByText("Schaffhausen 1")).toBeInTheDocument();
    expect(screen.getByText("Winterthur")).toBeInTheDocument();
  });

  it("opens lesson details and persists cancellation of a concrete lesson", async () => {
    const lessonId = "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/lessons/${lessonId}`) return { ok: true, json: async () => ({ lesson: { status: "cancelled" } }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", name: "A1", capacity: 10, location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", location_name: "Schaffhausen 1" }] }) };
      if (url.startsWith("/api/lessons?date=")) { const date = new URL(url, "https://linguasud.test").searchParams.get("date") ?? "2026-09-07"; return { ok: true, json: async () => ({ lessons: [{ id: lessonId, code: "MARKELDEA201", language: "Deutsch", level: "A2", room_id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", teacher_id: "415b4286-8f23-433a-bf9b-ca205d7d7782", teacher_name: "Maria Keller", starts_at: `${date}T18:00:00.000Z`, duration_minutes: 90, participant_count: 5, status: "scheduled", standard_location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", standard_location_name: "Schaffhausen 1" }] }) }; }
      return { ok: false, json: async () => ({ error: "Nicht angemeldet." }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LinguasudDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: /MARKELDEA201/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lektion absagen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/lessons/${lessonId}`, expect.objectContaining({ method: "PATCH" })));
  });

  it("assigns a qualified substitute to one concrete lesson", async () => {
    const lessonId = "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9";
    const substituteId = "7c2ebd74-b66c-4a6f-a36d-5303ee355d9a";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/lessons/${lessonId}` && init?.method === "PATCH") return { ok: true, json: async () => ({ lesson: {} }) };
      if (url === "/api/teachers") return { ok: true, json: async () => ({ teachers: [{ id: substituteId, name: "Elena Roth", active: true, teaching_levels: [{ language: "Deutsch", levels: ["A2"] }] }] }) };
      if (url === "/api/rooms") return { ok: true, json: async () => ({ rooms: [{ id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", name: "A1", capacity: 10, location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", location_name: "Schaffhausen 1" }] }) };
      if (url.startsWith("/api/lessons?date=")) { const date = new URL(url, "https://linguasud.test").searchParams.get("date") ?? "2026-09-07"; return { ok: true, json: async () => ({ lessons: [{ id: lessonId, code: "MARKELDEA201", language: "Deutsch", level: "A2", room_id: "76fdaccd-3e1d-4d70-b094-3e24e982555f", teacher_id: "415b4286-8f23-433a-bf9b-ca205d7d7782", teacher_name: "Maria Keller", starts_at: `${date}T18:00:00.000Z`, duration_minutes: 90, participant_count: 5, status: "scheduled", standard_location_id: "eced4674-d3f5-4d91-b4b2-d0d607c8d118", standard_location_name: "Schaffhausen 1" }] }) }; }
      return { ok: false, json: async () => ({ error: "Nicht angemeldet." }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LinguasudDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: /MARKELDEA201/ }));
    fireEvent.click(screen.getByRole("button", { name: "Details bearbeiten" }));
    await screen.findByRole("option", { name: "Elena Roth" });
    fireEvent.change(screen.getByLabelText("Vertretende Lehrperson"), { target: { value: substituteId } });
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/lessons/${lessonId}`, expect.objectContaining({ method: "PATCH" })));
    const update = fetchMock.mock.calls.find(([url, init]) => url === `/api/lessons/${lessonId}` && init?.method === "PATCH");
    expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ teacherId: substituteId, roomId: "76fdaccd-3e1d-4d70-b094-3e24e982555f" });
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

    fireEvent.click(screen.getByRole("button", { name: /Neuer Kurs/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Neuer Kurs" })).toBeInTheDocument();
  });
});
