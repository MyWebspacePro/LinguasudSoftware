import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoomsWorkspace } from "./rooms-workspace";

describe("RoomsWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates locations and rooms through the administration endpoints", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/locations" && init?.method === "POST") return { ok: true, json: async () => ({ location: { id: "location-2" } }) };
      if (url === "/api/rooms" && init?.method === "POST") return { ok: true, json: async () => ({ room: { id: "room-2" } }) };
      if (url === "/api/locations") return { ok: true, json: async () => ({ locations: [{ id: "location-1", name: "Schaffhausen", address: "Beispielgasse 1", sort_order: 1 }] }) };
      if (url.startsWith("/api/rooms")) return { ok: true, json: async () => ({ rooms: [{ id: "room-1", location_id: "location-1", location_name: "Schaffhausen", name: "A1", capacity: 12 }] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RoomsWorkspace />);

    await screen.findByText("Schaffhausen");
    fireEvent.click(screen.getByRole("button", { name: /Standort anlegen/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Winterthur" } });
    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Bahnhofplatz 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Standort speichern" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/locations", expect.objectContaining({ method: "POST" })));

    fireEvent.click(screen.getByRole("button", { name: /Raum anlegen/ }));
    fireEvent.change(screen.getByLabelText("Standort"), { target: { value: "location-1" } });
    fireEvent.change(screen.getByLabelText("Raumname"), { target: { value: "B2" } });
    fireEvent.change(screen.getByLabelText("Kapazität"), { target: { value: "16" } });
    fireEvent.click(screen.getByRole("button", { name: "Raum speichern" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rooms", expect.objectContaining({ method: "POST" })));

    const locationCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/locations" && init?.method === "POST");
    expect(JSON.parse(String(locationCall?.[1]?.body))).toMatchObject({ name: "Winterthur", address: "Bahnhofplatz 2", sortOrder: 2 });
    const roomCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/rooms" && init?.method === "POST");
    expect(JSON.parse(String(roomCall?.[1]?.body))).toMatchObject({ locationId: "location-1", name: "B2", capacity: 16 });
  });

  it("edits a room through its stable room reference", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/locations") return { ok: true, json: async () => ({ locations: [{ id: "location-1", name: "Schaffhausen", address: "Beispielgasse 1", sort_order: 1 }] }) };
      if (url === "/api/rooms" && init?.method === "PATCH") return { ok: true, json: async () => ({ room: { id: "room-1" } }) };
      if (url.startsWith("/api/rooms")) return { ok: true, json: async () => ({ rooms: [{ id: "room-1", location_id: "location-1", location_name: "Schaffhausen", name: "A1", capacity: 12, active: true }] }) };
      return { ok: false, json: async () => ({ error: "Unbekannte Anfrage" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RoomsWorkspace />);

    await screen.findByText("Schaffhausen");
    fireEvent.click(screen.getByRole("button", { name: "Raum bearbeiten" }));
    fireEvent.change(screen.getByLabelText("Raumname"), { target: { value: "A1 neu" } });
    fireEvent.change(screen.getByLabelText("Kapazität"), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Raum speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rooms/room-1", expect.objectContaining({ method: "PATCH" })));
    const updateCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/rooms/room-1" && init?.method === "PATCH");
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ locationId: "location-1", name: "A1 neu", capacity: 14, active: true });
  });
});
