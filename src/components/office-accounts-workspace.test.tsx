import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfficeAccountsWorkspace } from "./office-accounts-workspace";

describe("OfficeAccountsWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a separate office account without using participant or teacher records", async () => {
    const existing = { id: "office-1", name: "Büro", email: "office@example.test", role: "office", active: true, created_at: "2026-09-01T09:00:00.000Z" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/users" && init?.method === "POST") return { ok: true, json: async () => ({ user: { id: "office-2" } }) };
      if (url === "/api/users?role=office") return { ok: true, json: async () => ({ users: [existing] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<OfficeAccountsWorkspace currentUserId="office-1" onClose={vi.fn()} />);

    expect(await screen.findByText("office@example.test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Bürokonto anlegen" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nora Büro" } });
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "nora@example.test" } });
    fireEvent.change(screen.getByLabelText("Startpasswort"), { target: { value: "SicheresPasswort12" } });
    fireEvent.click(screen.getByRole("button", { name: "Bürokonto anlegen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/users", expect.objectContaining({ method: "POST" })));
    const createCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/users" && init?.method === "POST");
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ name: "Nora Büro", email: "nora@example.test", password: "SicheresPasswort12", role: "office" });
  });
});
