import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the Budget Terry heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Budget Terry" })).toBeInTheDocument();
  });
});
