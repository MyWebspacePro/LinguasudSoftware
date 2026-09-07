import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PeopleWorkspace } from "./people-workspace";

describe("PeopleWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a participant account and submits a course enrollment", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/users" && init?.method === "POST") return { ok: true, json: async () => ({ user: { id: "participant-2" } }) };
      if (url === "/api/enrollments" && init?.method === "POST") return { ok: true, json: async () => ({ enrollment: { id: "enrollment-1" } }) };
      if (url === "/api/users") return { ok: true, json: async () => ({ users: [{ id: "participant-1", name: "Lea Baumann", email: "lea@example.test", role: "participant" }] }) };
      if (url === "/api/courses") return { ok: true, json: async () => ({ courses: [{ id: "course-1", code: "DEUA101", language: "Deutsch", level: "A1", teacher_name: "Mia Muster" }] }) };
      if (url === "/api/enrollments") return { ok: true, json: async () => ({ enrollments: [] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PeopleWorkspace />);

    await screen.findByText("Lea Baumann");
    fireEvent.click(screen.getByRole("button", { name: /Person anlegen/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mira Frei" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "mira@example.test" } });
    fireEvent.change(screen.getByLabelText("Startpasswort"), { target: { value: "SicheresPasswort12" } });
    fireEvent.click(screen.getByRole("button", { name: "Zugang anlegen" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/users", expect.objectContaining({ method: "POST" })));

    fireEvent.click(screen.getByRole("button", { name: /In Kurs einschreiben/ }));
    fireEvent.change(screen.getByLabelText("Teilnehmer:in"), { target: { value: "participant-1" } });
    fireEvent.change(screen.getByLabelText("Kurs"), { target: { value: "course-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Einschreiben" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/enrollments", expect.objectContaining({ method: "POST" })));
    const enrollmentCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/enrollments" && init?.method === "POST");
    expect(JSON.parse(String(enrollmentCall?.[1]?.body))).toMatchObject({ participantId: "participant-1", courseId: "course-1", billingType: "private", creditLessons: 14 });
  });
});
