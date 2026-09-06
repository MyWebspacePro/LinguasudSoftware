import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinguasudDashboard } from "./linguasud-dashboard";

describe("LinguasudDashboard", () => {
  it("shows the daily room plan and lesson cards", () => {
    render(<LinguasudDashboard />);

    expect(screen.getByRole("heading", { name: "Raumplan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MARKELDEA201/ })).toBeInTheDocument();
    expect(screen.getByText("Schaffhausen 1")).toBeInTheDocument();
    expect(screen.getByText("Winterthur")).toBeInTheDocument();
  });

  it("opens lesson details and supports cancelling a concrete lesson", () => {
    render(<LinguasudDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /MARKELDEA201/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lektion absagen" }));

    expect(screen.getByText(/ist abgesagt/)).toBeInTheDocument();
  });

  it("provides the courses workspace", () => {
    render(<LinguasudDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Kurse" }));
    expect(screen.getByRole("heading", { name: /Aktive Kurse/ })).toBeInTheDocument();
  });
});
