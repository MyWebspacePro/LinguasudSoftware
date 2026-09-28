import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends credentials to the login endpoint and redirects after a successful login", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { id: "1" } }), { status: 200 }));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), { target: { value: "buero@linguasud.ch" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "sicheres-passwort" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" })));
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the server error without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "E-Mail oder Passwort ist falsch." }), { status: 401 }));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), { target: { value: "buero@linguasud.ch" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "sicheres-passwort" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-Mail oder Passwort ist falsch.");
    expect(replace).not.toHaveBeenCalled();
  });
});
