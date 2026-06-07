import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-selector";
import { MultimodalInput } from "@/components/multimodal-input";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("server-only", () => ({}));

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <LanguageProvider initialLang="en">{children}</LanguageProvider>
    </TooltipProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: AllProviders });
}

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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/use-text-speed", () => ({
  useTextSpeed: () => ({ delay: 50 }),
}));

const mockStop = vi.fn();
const mockSendMessage = vi.fn();
const mockSetMessages = vi.fn();
const mockSetInput = vi.fn();
const mockSetAttachments = vi.fn();

function createProps(status: "ready" | "streaming" | "submitted") {
  return {
    chatId: "test-chat-id",
    input: "",
    setInput: mockSetInput,
    status,
    stop: mockStop,
    attachments: [],
    setAttachments: mockSetAttachments,
    setMessages: mockSetMessages,
    sendMessage: mockSendMessage,
    selectedVisibilityType: "private" as const,
  };
}

describe("MultimodalInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("component structure", () => {
    it("renders textarea for input", () => {
      renderWithProviders(<MultimodalInput {...createProps("ready")} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("has send button disabled when empty", () => {
      renderWithProviders(<MultimodalInput {...createProps("ready")} />);

      const sendButton = screen.getByTestId("send-button");
      expect(sendButton).toBeDisabled();
    });

    it("has send button enabled when input has text", () => {
      renderWithProviders(
        <MultimodalInput {...createProps("ready")} input="Hello" />
      );

      const sendButton = screen.getByTestId("send-button");
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe("streaming state", () => {
    it("shows stop button when status is streaming", () => {
      renderWithProviders(<MultimodalInput {...createProps("streaming")} />);

      const stopButton = screen.getByTestId("stop-button");
      expect(stopButton).toBeInTheDocument();
    });

    it("shows stop button when status is submitted", () => {
      renderWithProviders(<MultimodalInput {...createProps("submitted")} />);

      const stopButton = screen.getByTestId("stop-button");
      expect(stopButton).toBeInTheDocument();
    });

    it("does not show send button when streaming", () => {
      renderWithProviders(<MultimodalInput {...createProps("streaming")} />);

      const sendButton = screen.queryByTestId("send-button");
      expect(sendButton).not.toBeInTheDocument();
    });

    it("does not show send button when submitted", () => {
      renderWithProviders(<MultimodalInput {...createProps("submitted")} />);

      const sendButton = screen.queryByTestId("send-button");
      expect(sendButton).not.toBeInTheDocument();
    });

    it("disables textarea when status is streaming", () => {
      renderWithProviders(<MultimodalInput {...createProps("streaming")} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeDisabled();
    });

    it("disables textarea when status is submitted", () => {
      renderWithProviders(<MultimodalInput {...createProps("submitted")} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeDisabled();
    });

    it("disables send button when streaming", () => {
      renderWithProviders(
        <MultimodalInput {...createProps("streaming")} input="Hello" />
      );

      const sendButton = screen.queryByTestId("send-button");
      expect(sendButton).not.toBeInTheDocument();
    });

    it("calls stop when stop button clicked", () => {
      renderWithProviders(<MultimodalInput {...createProps("streaming")} />);

      const stopButton = screen.getByTestId("stop-button");
      fireEvent.click(stopButton);

      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe("ready state", () => {
    it("textarea is not disabled when ready", () => {
      renderWithProviders(<MultimodalInput {...createProps("ready")} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).not.toBeDisabled();
    });

    it("shows send button when ready", () => {
      renderWithProviders(
        <MultimodalInput {...createProps("ready")} input="Hello" />
      );

      const sendButton = screen.getByTestId("send-button");
      expect(sendButton).toBeInTheDocument();
    });
  });
});
