import { useChat } from "@ai-sdk/react";
import type { RenderOptions } from "@testing-library/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "@/components/chat-interface";
import { LanguageProvider } from "@/components/language-selector";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/types";

vi.mock("server-only", () => ({}));

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

vi.mock("swr", () => ({
  useSWRConfig: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("swr/infinite", () => ({
  unstable_serialize: vi.fn(() => "chat-history-key"),
}));

const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockSetMessagesHook = vi.fn();
const mockRegenerate = vi.fn();
const mockAddToolApprovalResponse = vi.fn();
const mockResumeStream = vi.fn();
const mockAddToolResult = vi.fn();
const mockAddToolOutput = vi.fn();
const mockClearError = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: mockSendMessage,
    status: "ready",
    stop: mockStop,
    setMessages: mockSetMessagesHook,
    regenerate: mockRegenerate,
    addToolApprovalResponse: mockAddToolApprovalResponse,
    resumeStream: mockResumeStream,
    addToolResult: mockAddToolResult,
    addToolOutput: mockAddToolOutput,
    clearError: mockClearError,
  })),
}));

vi.mock("@/components/language-selector", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/language-selector")>();
  return {
    ...actual,
    useLanguage: () => ({ lang: "en" }),
  };
});

vi.mock("@/hooks/use-text-speed", () => ({
  useTextSpeed: () => ({ delay: 50 }),
}));

vi.mock("@/hooks/use-messages", () => ({
  useMessages: () => ({
    containerRef: { current: null },
    endRef: { current: null },
  }),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...original,
    generateUUID: () => "test-uuid-123",
  };
});

describe("ChatInterface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("component structure", () => {
    it("renders chat interface container", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const mainElement = screen.getByRole("main");
      expect(mainElement).toBeInTheDocument();
    });

    it("renders with initial messages prop", () => {
      const messages: ChatMessage[] = [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        },
      ];

      renderWithProviders(<ChatInterface initialMessages={messages} />);

      expect(screen.getByRole("main")).toBeInTheDocument();
    });

    it("renders empty state when no messages", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    it("renders avatar in empty state", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const avatars = screen.getAllByAltText("Destiny");
      expect(avatars.length).toBeGreaterThan(0);
    });

    it("renders compliance information", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      expect(
        screen.getByText(/Destiny is very smart but not perfect/i)
      ).toBeInTheDocument();
    });
  });

  describe("message submission", () => {
    it("has textarea for input", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeInTheDocument();
    });

    it("has send button disabled when empty", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const sendButton = screen.getByTestId("send-button");
      expect(sendButton).toBeDisabled();
    });

    it("calls sendMessage when user submits", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const input = screen.getByTestId("multimodal-input");
      fireEvent.change(input, { target: { value: "Test message" } });

      const sendButton = screen.getByTestId("send-button");
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it("submits on Enter key", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const input = screen.getByTestId("multimodal-input");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

      expect(mockSendMessage).toHaveBeenCalled();
    });

    it("does not submit on Shift+Enter", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const input = screen.getByTestId("multimodal-input");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("shows stop button when streaming", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "streaming",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const stopButton = screen.getByTestId("stop-button");
      expect(stopButton).toBeInTheDocument();
    });

    it("calls stop when clicked", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "streaming",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const stopButton = screen.getByTestId("stop-button");
      fireEvent.click(stopButton);

      expect(mockStop).toHaveBeenCalled();
    });

    it("does not submit when status is streaming", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "streaming",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const input = screen.getByTestId("multimodal-input");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("does not submit when status is submitted", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "submitted",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const input = screen.getByTestId("multimodal-input");
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("textarea is disabled during streaming", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "streaming",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeDisabled();
    });

    it("send button is not shown during streaming", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "streaming",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const sendButton = screen.queryByTestId("send-button");
      expect(sendButton).not.toBeInTheDocument();
    });

    it("textarea is disabled during submitted", () => {
      vi.mocked(useChat).mockReturnValue({
        id: "test-chat-id",
        messages: [],
        sendMessage: mockSendMessage,
        status: "submitted",
        stop: mockStop,
        setMessages: mockSetMessagesHook,
        regenerate: mockRegenerate,
        addToolApprovalResponse: mockAddToolApprovalResponse,
        resumeStream: mockResumeStream,
        addToolResult: mockAddToolResult,
        addToolOutput: mockAddToolOutput,
        clearError: mockClearError,
        error: undefined,
      });

      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeDisabled();
    });
  });

  describe("scenario tabs", () => {
    it("renders scenario tabs", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("activates scenario tab on click", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const scenarioTabs = screen.getAllByRole("button");
      fireEvent.click(scenarioTabs[0]);

      expect(scenarioTabs[0]).toBeInTheDocument();
    });
  });

  describe("personality selector", () => {
    it("shows personality selector", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const personalityButton = screen.getByLabelText(/personality/i);
      expect(personalityButton).toBeInTheDocument();
    });

    it("opens personality dropdown", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const personalityButton = screen.getByLabelText(/personality/i);
      fireEvent.click(personalityButton);

      expect(screen.getByText(/default/i)).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper alt text on images", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const avatars = screen.getAllByAltText("Destiny");
      expect(avatars.length).toBeGreaterThan(0);
    });

    it("has proper button types", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toHaveAttribute("type");
      }
    });

    it("has textarea for chat input", () => {
      renderWithProviders(<ChatInterface initialMessages={[]} />);

      const textarea = screen.getByTestId("multimodal-input");
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe("TEXTAREA");
    });
  });
});
