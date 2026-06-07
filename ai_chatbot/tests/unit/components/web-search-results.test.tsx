import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WebSearchResults } from "@/components/web-search-results";

const mockUrls = [
  { url: "https://example.com/page1" },
  { url: "https://example.com/page2" },
  { url: "https://example.com/page3" },
];

describe("WebSearchResults", () => {
  describe("component structure", () => {
    it("renders without crashing", () => {
      render(<WebSearchResults urls={mockUrls} />);

      const container = screen.getByTestId("web-search-results");
      expect(container).toBeInTheDocument();
    });
  });

  describe("rendering with URLs", () => {
    it("renders list of URLs with correct numbering", () => {
      render(<WebSearchResults urls={mockUrls} />);

      const links = screen.getAllByTestId("web-search-url");
      expect(links).toHaveLength(3);

      expect(screen.getByText("[1]")).toBeInTheDocument();
      expect(screen.getByText("[2]")).toBeInTheDocument();
      expect(screen.getByText("[3]")).toBeInTheDocument();
    });

    it("renders correct URL text for each link", () => {
      render(<WebSearchResults urls={mockUrls} />);

      for (const { url } of mockUrls) {
        expect(screen.getByText(url)).toBeInTheDocument();
      }
    });
  });

  describe("link attributes", () => {
    it("each URL is a clickable link with correct attributes", () => {
      render(<WebSearchResults urls={mockUrls} />);

      const links = screen.getAllByTestId("web-search-url");

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        expect(link).toHaveAttribute("href", mockUrls[i].url);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    });
  });

  describe("search query", () => {
    it("displays search query when provided", () => {
      render(<WebSearchResults searchQuery="test query" urls={mockUrls} />);

      expect(screen.getByText("Search: test query")).toBeInTheDocument();
    });

    it("does not display search query when not provided", () => {
      render(<WebSearchResults urls={mockUrls} />);

      expect(screen.queryByText(/Search:/)).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows 'No results found' when urls array is empty", () => {
      render(<WebSearchResults urls={[]} />);

      expect(screen.getByText("No results found")).toBeInTheDocument();
    });

    it("does not render any links when urls array is empty", () => {
      render(<WebSearchResults urls={[]} />);

      const links = screen.queryAllByTestId("web-search-url");
      expect(links).toHaveLength(0);
    });
  });
});
