import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfficeAttendanceWorkspace } from "./office-attendance-workspace";

describe("OfficeAttendanceWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads a scheduled lesson, lets the office update attendance, and saves it", async () => {
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
            participant_count: 2,
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          attendance: [
            { enrollment_id: "9fdbf5d8-d717-4a11-8368-d019a4a53e7a", participant_name: "Lea Baumann", status: null },
            { enrollment_id: "3e77aae7-ec0a-4ddd-8bba-f04b48f1f54b", participant_name: "Amir Hussein", status: "excused_pending" },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ attendance: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const onNotice = vi.fn();

    render(<OfficeAttendanceWorkspace onNotice={onNotice} />);

    expect(await screen.findByLabelText("Lea Baumann Anwesenheit")).toHaveValue("present");
    expect(screen.getByLabelText("Amir Hussein Anwesenheit")).toHaveValue("excused_pending");
    fireEvent.change(screen.getByLabelText("Lea Baumann Anwesenheit"), { target: { value: "unexcused" } });
    fireEvent.change(screen.getByLabelText("Amir Hussein Anwesenheit"), { target: { value: "excused" } });
    fireEvent.click(screen.getByRole("button", { name: "Anwesenheit speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/attendance", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        lessonId: "8af5cb1e-13c4-4bbe-8e60-52f396e79cb9",
        entries: [
          { enrollmentId: "9fdbf5d8-d717-4a11-8368-d019a4a53e7a", status: "unexcused" },
          { enrollmentId: "3e77aae7-ec0a-4ddd-8bba-f04b48f1f54b", status: "excused" },
        ],
      }),
    }));
    expect(onNotice).toHaveBeenCalledWith("Anwesenheit wurde gespeichert.");
  });
});
