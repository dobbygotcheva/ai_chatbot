import type { AppDefinition } from "./types";

export const APP_REGISTRY: AppDefinition[] = [
  {
    id: "microsoft-outlook",
    name: "Microsoft Outlook",
    description:
      "Read emails, send messages, manage calendar events and contacts through Outlook.",
    icon: "outlook",
    category: "communication",
    authMethod: "oauth2",
    oauthProvider: "microsoft",
    requiredScopes: [
      "Mail.Read",
      "Mail.Send",
      "Calendars.ReadWrite",
      "Contacts.Read",
      "offline_access",
    ],
    tools: [
      {
        name: "list_emails",
        description: "List recent emails from inbox",
        parameters: {
          count: {
            type: "number",
            description: "Number of emails to retrieve (default: 10)",
          },
          folder: {
            type: "string",
            description: "Folder to list (inbox, sent, drafts)",
          },
        },
      },
      {
        name: "read_email",
        description: "Read the content of a specific email",
        parameters: {
          messageId: {
            type: "string",
            description: "The email message ID",
            required: true,
          },
        },
      },
      {
        name: "send_email",
        description: "Send an email",
        parameters: {
          to: {
            type: "string",
            description: "Recipient email address",
            required: true,
          },
          subject: {
            type: "string",
            description: "Email subject",
            required: true,
          },
          body: {
            type: "string",
            description: "Email body content (HTML or plain text)",
            required: true,
          },
          cc: {
            type: "string",
            description: "CC email addresses (comma-separated)",
          },
        },
      },
      {
        name: "list_calendar_events",
        description: "List upcoming calendar events",
        parameters: {
          days: {
            type: "number",
            description: "Number of days ahead to look (default: 7)",
          },
        },
      },
      {
        name: "create_calendar_event",
        description: "Create a new calendar event",
        parameters: {
          subject: {
            type: "string",
            description: "Event subject",
            required: true,
          },
          start: {
            type: "string",
            description: "Start datetime in ISO 8601 format",
            required: true,
          },
          end: {
            type: "string",
            description: "End datetime in ISO 8601 format",
            required: true,
          },
          attendees: {
            type: "string",
            description: "Attendee email addresses (comma-separated)",
          },
          body: {
            type: "string",
            description: "Event description",
          },
        },
      },
    ],
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    description:
      "Send messages, read channels, list teams, and interact with Teams chats.",
    icon: "teams",
    category: "communication",
    authMethod: "oauth2",
    oauthProvider: "microsoft",
    requiredScopes: [
      "Chat.Read",
      "Chat.ReadWrite",
      "Channel.ReadBasic.All",
      "ChannelMessage.Read.All",
      "ChannelMessage.Send",
      "Team.ReadBasic.All",
      "offline_access",
    ],
    tools: [
      {
        name: "list_teams",
        description: "List all Teams the user belongs to",
        parameters: {},
      },
      {
        name: "list_channels",
        description: "List channels in a team",
        parameters: {
          teamId: {
            type: "string",
            description: "The team ID",
            required: true,
          },
        },
      },
      {
        name: "list_channel_messages",
        description: "List recent messages in a channel",
        parameters: {
          teamId: {
            type: "string",
            description: "The team ID",
            required: true,
          },
          channelId: {
            type: "string",
            description: "The channel ID",
            required: true,
          },
          count: {
            type: "number",
            description: "Number of messages to retrieve (default: 20)",
          },
        },
      },
      {
        name: "send_channel_message",
        description: "Send a message to a Teams channel",
        parameters: {
          teamId: {
            type: "string",
            description: "The team ID",
            required: true,
          },
          channelId: {
            type: "string",
            description: "The channel ID",
            required: true,
          },
          message: {
            type: "string",
            description: "The message text",
            required: true,
          },
        },
      },
      {
        name: "list_chats",
        description: "List recent direct chats",
        parameters: {},
      },
      {
        name: "send_chat_message",
        description: "Send a direct chat message",
        parameters: {
          chatId: {
            type: "string",
            description: "The chat ID",
            required: true,
          },
          message: {
            type: "string",
            description: "The message text",
            required: true,
          },
        },
      },
    ],
  },
  {
    id: "jira",
    name: "Jira",
    description:
      "Search issues, create tickets, update statuses, and manage Jira projects.",
    icon: "jira",
    category: "collaboration",
    authMethod: "apikey",
    configFields: [
      {
        key: "baseUrl",
        label: "Jira Base URL",
        type: "url",
        required: true,
        placeholder: "https://yourcompany.atlassian.net",
        helpText: "Your Atlassian Cloud or Server instance URL",
      },
      {
        key: "email",
        label: "Account Email",
        type: "text",
        required: true,
        placeholder: "you@company.com",
      },
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        required: true,
        helpText: "Generate at https://id.atlassian.com/manage/api-tokens",
      },
    ],
    tools: [
      {
        name: "search_issues",
        description: "Search Jira issues using JQL",
        parameters: {
          jql: {
            type: "string",
            description:
              "JQL query string (e.g. 'project = PROJ AND status = Open')",
            required: true,
          },
          maxResults: {
            type: "number",
            description: "Maximum results to return (default: 20)",
          },
        },
      },
      {
        name: "get_issue",
        description: "Get details of a specific Jira issue",
        parameters: {
          issueKey: {
            type: "string",
            description: "Issue key (e.g. PROJ-123)",
            required: true,
          },
        },
      },
      {
        name: "create_issue",
        description: "Create a new Jira issue",
        parameters: {
          projectKey: {
            type: "string",
            description: "Project key",
            required: true,
          },
          summary: {
            type: "string",
            description: "Issue summary/title",
            required: true,
          },
          description: {
            type: "string",
            description: "Issue description",
          },
          issueType: {
            type: "string",
            description: "Issue type (Bug, Story, Task, Epic)",
            enum: ["Bug", "Story", "Task", "Epic", "Subtask"],
          },
          priority: {
            type: "string",
            description: "Priority (Highest, High, Medium, Low, Lowest)",
            enum: ["Highest", "High", "Medium", "Low", "Lowest"],
          },
          assignee: {
            type: "string",
            description: "Assignee account ID or email",
          },
        },
      },
      {
        name: "update_issue",
        description: "Update a Jira issue",
        parameters: {
          issueKey: {
            type: "string",
            description: "Issue key",
            required: true,
          },
          summary: {
            type: "string",
            description: "New summary",
          },
          status: {
            type: "string",
            description: "New status transition name",
          },
          assignee: {
            type: "string",
            description: "New assignee account ID",
          },
          comment: {
            type: "string",
            description: "Add a comment",
          },
        },
      },
      {
        name: "list_projects",
        description: "List available Jira projects",
        parameters: {},
      },
    ],
  },
  {
    id: "confluence",
    name: "Confluence",
    description:
      "Search pages, read content, create and update Confluence wiki pages.",
    icon: "confluence",
    category: "collaboration",
    authMethod: "apikey",
    configFields: [
      {
        key: "baseUrl",
        label: "Confluence Base URL",
        type: "url",
        required: true,
        placeholder: "https://yourcompany.atlassian.net",
        helpText: "Same as your Atlassian instance URL",
      },
      {
        key: "email",
        label: "Account Email",
        type: "text",
        required: true,
        placeholder: "you@company.com",
      },
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        required: true,
        helpText: "Same token used for Jira",
      },
    ],
    tools: [
      {
        name: "search_pages",
        description: "Search Confluence pages using CQL",
        parameters: {
          query: {
            type: "string",
            description: "Search query text",
            required: true,
          },
          spaceKey: {
            type: "string",
            description: "Limit search to a specific space",
          },
          maxResults: {
            type: "number",
            description: "Maximum results (default: 10)",
          },
        },
      },
      {
        name: "get_page",
        description: "Get content of a Confluence page",
        parameters: {
          pageId: {
            type: "string",
            description: "Page ID",
            required: true,
          },
        },
      },
      {
        name: "create_page",
        description: "Create a new Confluence page",
        parameters: {
          spaceKey: {
            type: "string",
            description: "Space key",
            required: true,
          },
          title: {
            type: "string",
            description: "Page title",
            required: true,
          },
          content: {
            type: "string",
            description: "Page content in storage format or plain text",
            required: true,
          },
          parentId: {
            type: "string",
            description: "Parent page ID",
          },
        },
      },
      {
        name: "update_page",
        description: "Update an existing Confluence page",
        parameters: {
          pageId: {
            type: "string",
            description: "Page ID",
            required: true,
          },
          title: {
            type: "string",
            description: "New page title",
          },
          content: {
            type: "string",
            description: "New page content",
            required: true,
          },
        },
      },
      {
        name: "list_spaces",
        description: "List available Confluence spaces",
        parameters: {},
      },
    ],
  },
  {
    id: "libreoffice",
    name: "LibreOffice",
    description:
      "Convert, read, and create Office documents (Writer, Calc, Impress) on the server.",
    icon: "libreoffice",
    category: "office",
    authMethod: "none",
    tools: [
      {
        name: "convert_document",
        description: "Convert a document between formats (e.g. docx → pdf)",
        parameters: {
          sourceFormat: {
            type: "string",
            description: "Source format (docx, odt, xlsx, ods, pptx, odp)",
            required: true,
          },
          targetFormat: {
            type: "string",
            description: "Target format (pdf, docx, odt, xlsx, ods, html)",
            required: true,
          },
          content: {
            type: "string",
            description: "Base64-encoded file content",
            required: true,
          },
        },
      },
      {
        name: "extract_text",
        description: "Extract plain text from an Office document",
        parameters: {
          format: {
            type: "string",
            description: "Document format (docx, odt, xlsx, pptx)",
            required: true,
          },
          content: {
            type: "string",
            description: "Base64-encoded file content",
            required: true,
          },
        },
      },
      {
        name: "create_text_document",
        description: "Create a new text document from plain text or markdown",
        parameters: {
          title: {
            type: "string",
            description: "Document title",
            required: true,
          },
          content: {
            type: "string",
            description: "Document text content",
            required: true,
          },
          format: {
            type: "string",
            description: "Output format (odt, docx, pdf)",
            enum: ["odt", "docx", "pdf"],
          },
        },
      },
    ],
  },
];

export function getAppById(id: string): AppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}

export function getAppsByCategory(
  category: AppDefinition["category"]
): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}

export function getMicrosoftApps(): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.oauthProvider === "microsoft");
}
