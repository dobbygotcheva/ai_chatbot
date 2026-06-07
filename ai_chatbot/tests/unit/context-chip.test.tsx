import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContextChip } from "@/components/context-chip";

describe("ContextChip", () => {
  it("clamps percentage to 100%", () => {
    render(<ContextChip percentage={120} />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps percentage to 0%", () => {
    render(<ContextChip percentage={-10} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("uses the red color scheme when clamped >= 90", () => {
    const { container } = render(<ContextChip percentage={95} />);
    const chip = screen.getByTestId("context-chip");

    expect(chip).toHaveTextContent("95%");
    expect(chip).toHaveAttribute("data-tone", "red");

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it('renders an always-visible "Context used" label next to the bar', () => {
    render(<ContextChip percentage={50} />);

    const chip = screen.getByTestId("context-chip");
    expect(chip).toHaveTextContent("Context used");
    expect(chip).toHaveTextContent("50%");
  });

  it('does not duplicate the "Context used" label via the SVG title', () => {
    const { container } = render(<ContextChip percentage={50} />);

    const title = container.querySelector("svg title");
    expect(title).not.toBeNull();
    expect(title?.textContent).not.toBe("Context used");
  });
});
