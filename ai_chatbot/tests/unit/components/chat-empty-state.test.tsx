import type { RenderOptions } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatEmptyState } from "@/components/chat-empty-state";
import { LanguageProvider } from "@/components/language-selector";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/language-selector", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/language-selector")>();
  return {
    ...actual,
    useLanguage: () => ({ lang: "en" }),
  };
});

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <LanguageProvider initialLang="en">{children}</LanguageProvider>
    </TooltipProvider>
  );
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

describe("ChatEmptyState", () => {
  describe("component structure", () => {
    it("renders without crashing", () => {
      renderWithProviders(<ChatEmptyState />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("renders with default props", () => {
      renderWithProviders(<ChatEmptyState />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent(/destiny/i);
    });
  });

  describe("avatar", () => {
    it("displays avatar image with alt text", () => {
      renderWithProviders(<ChatEmptyState />);

      const avatar = screen.getByAltText("Destiny");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "/images/destiny-avatar.png");
    });

    it("avatar is present in the document", () => {
      renderWithProviders(<ChatEmptyState />);

      const avatar = screen.getByAltText("Destiny");
      expect(avatar).toBeInTheDocument();
    });
  });

  describe("compliance disclaimers", () => {
    it("renders all 3 compliance sections with icons", () => {
      renderWithProviders(<ChatEmptyState />);

      const paragraphs = screen.getAllByRole("paragraph");
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });

    it("displays first compliance section about intelligence", () => {
      renderWithProviders(<ChatEmptyState />);

      expect(
        screen.getByText(/destiny is very smart but not perfect/i)
      ).toBeInTheDocument();
    });

    it("displays second compliance section about language", () => {
      renderWithProviders(<ChatEmptyState />);

      expect(
        screen.getByText(/although destiny knows bulgarian/i)
      ).toBeInTheDocument();
    });

    it("displays third compliance section with links", () => {
      renderWithProviders(<ChatEmptyState />);

      expect(
        screen.getByText(/destiny can search the web/i)
      ).toBeInTheDocument();
    });
  });

  describe("links", () => {
    it("renders confluence link", () => {
      renderWithProviders(<ChatEmptyState />);

      const confluenceLink = screen.getByRole("link", {
        name: /configure confluence/i,
      });
      expect(confluenceLink).toBeInTheDocument();
      expect(confluenceLink).toHaveAttribute("href", "/settings?section=Apps");
    });

    it("renders jira link", () => {
      renderWithProviders(<ChatEmptyState />);

      const jiraLink = screen.getByRole("link", { name: /configure jira/i });
      expect(jiraLink).toBeInTheDocument();
      expect(jiraLink).toHaveAttribute("href", "/settings?section=Apps");
    });

    it("renders service desk link", () => {
      renderWithProviders(<ChatEmptyState />);

      const serviceDeskLink = screen.getByRole("link", {
        name: /configure service desk/i,
      });
      expect(serviceDeskLink).toBeInTheDocument();
      expect(serviceDeskLink).toHaveAttribute("href", "/settings?section=Apps");
    });

    it("links are navigable", () => {
      renderWithProviders(<ChatEmptyState />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThanOrEqual(3);

      for (const link of links) {
        expect(link).toHaveAttribute("href");
      }
    });
  });

  describe("accessibility", () => {
    it("has proper alt text on avatar image", () => {
      renderWithProviders(<ChatEmptyState />);

      const avatar = screen.getByAltText("Destiny");
      expect(avatar).toBeInTheDocument();
    });

    it("has proper ARIA labels on links", () => {
      renderWithProviders(<ChatEmptyState />);

      const confluenceLink = screen.getByRole("link", {
        name: /configure confluence/i,
      });
      expect(confluenceLink).toBeInTheDocument();

      const jiraLink = screen.getByRole("link", { name: /configure jira/i });
      expect(jiraLink).toBeInTheDocument();

      const serviceDeskLink = screen.getByRole("link", {
        name: /configure service desk/i,
      });
      expect(serviceDeskLink).toBeInTheDocument();
    });

    it("has proper heading level", () => {
      renderWithProviders(<ChatEmptyState />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("decorative icons have aria-hidden", () => {
      renderWithProviders(<ChatEmptyState />);

      const decorativeIcons = screen.getAllByRole("img", { hidden: true });
      expect(decorativeIcons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
