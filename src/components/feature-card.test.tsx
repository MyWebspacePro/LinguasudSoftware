import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureCard } from "./feature-card";

describe("FeatureCard", () => {
  it("renders its title and description", () => {
    render(
      <FeatureCard
        number="01"
        title="Strikte Typen"
        description="Eine verlässliche Grundlage."
      />,
    );

    expect(screen.getByRole("heading", { name: "Strikte Typen" })).toBeInTheDocument();
    expect(screen.getByText("Eine verlässliche Grundlage.")).toBeInTheDocument();
  });
});
