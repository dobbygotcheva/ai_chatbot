import { config } from "@/shared/config";
import type { Connector, ConnectorContext, ToolCallResult } from "../types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<unknown> {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft Graph API error ${response.status}: ${errorText}`
    );
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

// ─── Outlook Tools ─────────────────────────────────────────────────────────

async function listEmails(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const count = Number(params.count ?? 10);
  const folder = String(params.folder ?? "inbox");
  const folderPath =
    folder === "inbox"
      ? "inbox"
      : folder === "sent"
        ? "sentitems"
        : folder === "drafts"
          ? "drafts"
          : "inbox";

  try {
    const data = (await graphFetch(
      `/me/mailFolders/${folderPath}/messages?$top=${count}&$select=id,subject,from,receivedDateTime,bodyPreview,isRead`,
      ctx.accessToken
    )) as { value: unknown[] };

    return {
      success: true,
      data: {
        emails: data.value,
        count: data.value.length,
      },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function readEmail(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const messageId = String(params.messageId);

  try {
    const data = await graphFetch(
      `/me/messages/${messageId}?$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,attachments`,
      ctx.accessToken
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendEmail(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const toAddresses = String(params.to)
    .split(",")
    .map((addr) => addr.trim());
  const ccAddresses = params.cc
    ? String(params.cc)
        .split(",")
        .map((addr) => addr.trim())
    : [];

  const payload = {
    message: {
      subject: String(params.subject),
      body: {
        contentType: "HTML",
        content: String(params.body),
      },
      toRecipients: toAddresses.map((addr) => ({
        emailAddress: { address: addr },
      })),
      ...(ccAddresses.length > 0
        ? {
            ccRecipients: ccAddresses.map((addr) => ({
              emailAddress: { address: addr },
            })),
          }
        : {}),
    },
    saveToSentItems: true,
  };

  try {
    await graphFetch("/me/sendMail", ctx.accessToken, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return { success: true, data: { sent: true, to: params.to } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listCalendarEvents(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const days = Number(params.days ?? 7);
  const now = new Date().toISOString();
  const future = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const data = (await graphFetch(
      `/me/calendarView?startDateTime=${now}&endDateTime=${future}&$select=id,subject,start,end,location,attendees,bodyPreview&$orderby=start/dateTime`,
      ctx.accessToken
    )) as { value: unknown[] };

    return { success: true, data: { events: data.value } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function createCalendarEvent(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const attendeeList = params.attendees
    ? String(params.attendees)
        .split(",")
        .map((addr) => ({
          emailAddress: { address: addr.trim() },
          type: "required",
        }))
    : [];

  const payload = {
    subject: String(params.subject),
    body: params.body
      ? { contentType: "HTML", content: String(params.body) }
      : undefined,
    start: { dateTime: String(params.start), timeZone: "UTC" },
    end: { dateTime: String(params.end), timeZone: "UTC" },
    ...(attendeeList.length > 0 ? { attendees: attendeeList } : {}),
  };

  try {
    const data = await graphFetch("/me/events", ctx.accessToken, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Teams Tools ────────────────────────────────────────────────────────────

async function listTeams(
  _params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  try {
    const data = (await graphFetch(
      "/me/joinedTeams?$select=id,displayName,description",
      ctx.accessToken
    )) as { value: unknown[] };

    return { success: true, data: { teams: data.value } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listChannels(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const teamId = String(params.teamId);

  try {
    const data = (await graphFetch(
      `/teams/${teamId}/channels?$select=id,displayName,description`,
      ctx.accessToken
    )) as { value: unknown[] };

    return { success: true, data: { channels: data.value } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listChannelMessages(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const teamId = String(params.teamId);
  const channelId = String(params.channelId);
  const count = Number(params.count ?? 20);

  try {
    const data = (await graphFetch(
      `/teams/${teamId}/channels/${channelId}/messages?$top=${count}&$select=id,body,from,createdDateTime,messageType`,
      ctx.accessToken
    )) as { value: unknown[] };

    return { success: true, data: { messages: data.value } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendChannelMessage(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const teamId = String(params.teamId);
  const channelId = String(params.channelId);

  try {
    const data = await graphFetch(
      `/teams/${teamId}/channels/${channelId}/messages`,
      ctx.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          body: { contentType: "text", content: String(params.message) },
        }),
      }
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listChats(
  _params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  try {
    const data = (await graphFetch(
      "/me/chats?$select=id,chatType,topic,lastUpdatedDateTime",
      ctx.accessToken
    )) as { value: unknown[] };

    return { success: true, data: { chats: data.value } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendChatMessage(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  if (!ctx.accessToken) {
    return { success: false, error: "No access token available" };
  }

  const chatId = String(params.chatId);

  try {
    const data = await graphFetch(
      `/me/chats/${chatId}/messages`,
      ctx.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          body: { contentType: "text", content: String(params.message) },
        }),
      }
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Token refresh ──────────────────────────────────────────────────────────

async function refreshMicrosoftToken(
  ctx: ConnectorContext
): Promise<Partial<ConnectorContext>> {
  const refreshToken = ctx.refreshToken;
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const tenantId = config.azure.adTenantId ?? "organizations";
  const clientId = config.azure.adClientId ?? "";
  const clientSecret = config.azure.adClientSecret ?? "";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
  };
}

// ─── Connector exports ──────────────────────────────────────────────────────

export const outlookConnector: Connector = {
  appId: "microsoft-outlook",
  refreshToken: refreshMicrosoftToken,
  tools: {
    list_emails: listEmails,
    read_email: readEmail,
    send_email: sendEmail,
    list_calendar_events: listCalendarEvents,
    create_calendar_event: createCalendarEvent,
  },
};

export const teamsConnector: Connector = {
  appId: "microsoft-teams",
  refreshToken: refreshMicrosoftToken,
  tools: {
    list_teams: listTeams,
    list_channels: listChannels,
    list_channel_messages: listChannelMessages,
    send_channel_message: sendChannelMessage,
    list_chats: listChats,
    send_chat_message: sendChatMessage,
  },
};
