import type { Connector, ConnectorContext, ToolCallResult } from "../types";

function getBasicAuth(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

async function atlasFetch(
  baseUrl: string,
  path: string,
  auth: string,
  options: RequestInit = {}
): Promise<unknown> {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const response = await fetch(`${cleanBase}${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Atlassian API error ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function getAtlassianAuth(ctx: ConnectorContext): {
  baseUrl: string;
  auth: string;
} {
  const baseUrl = ctx.config?.baseUrl ?? "";
  const email = ctx.config?.email ?? "";
  const apiToken = ctx.config?.apiToken ?? "";

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Missing Atlassian configuration (baseUrl, email, apiToken)"
    );
  }

  return { baseUrl, auth: getBasicAuth(email, apiToken) };
}

// ─── Jira Tools ─────────────────────────────────────────────────────────────

async function searchJiraIssues(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const maxResults = Number(params.maxResults ?? 20);
    const jql = encodeURIComponent(String(params.jql));

    const data = (await atlasFetch(
      baseUrl,
      `/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,assignee,priority,issuetype,created,updated,description`,
      auth
    )) as { issues: unknown[]; total: number };

    return {
      success: true,
      data: { issues: data.issues, total: data.total },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getJiraIssue(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const issueKey = String(params.issueKey);

    const data = await atlasFetch(
      baseUrl,
      `/rest/api/3/issue/${issueKey}`,
      auth
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function createJiraIssue(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);

    const fields: Record<string, unknown> = {
      project: { key: String(params.projectKey) },
      summary: String(params.summary),
      issuetype: { name: String(params.issueType ?? "Task") },
    };

    if (params.description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: String(params.description) }],
          },
        ],
      };
    }

    if (params.priority) {
      fields.priority = { name: String(params.priority) };
    }

    const data = await atlasFetch(baseUrl, "/rest/api/3/issue", auth, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function updateJiraIssue(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const issueKey = String(params.issueKey);

    const fields: Record<string, unknown> = {};

    if (params.summary) {
      fields.summary = String(params.summary);
    }
    if (params.assignee) {
      fields.assignee = { accountId: String(params.assignee) };
    }

    if (Object.keys(fields).length > 0) {
      await atlasFetch(baseUrl, `/rest/api/3/issue/${issueKey}`, auth, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    }

    if (params.status) {
      const transitions = (await atlasFetch(
        baseUrl,
        `/rest/api/3/issue/${issueKey}/transitions`,
        auth
      )) as { transitions: Array<{ id: string; name: string }> };

      const target = transitions.transitions.find(
        (t) => t.name.toLowerCase() === String(params.status).toLowerCase()
      );

      if (target) {
        await atlasFetch(
          baseUrl,
          `/rest/api/3/issue/${issueKey}/transitions`,
          auth,
          {
            method: "POST",
            body: JSON.stringify({ transition: { id: target.id } }),
          }
        );
      }
    }

    if (params.comment) {
      await atlasFetch(baseUrl, `/rest/api/3/issue/${issueKey}/comment`, auth, {
        method: "POST",
        body: JSON.stringify({ body: String(params.comment) }),
      });
    }

    return { success: true, data: { updated: true, issueKey } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listJiraProjects(
  _params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const data = (await atlasFetch(
      baseUrl,
      "/rest/api/3/project/search?maxResults=50",
      auth
    )) as { values: unknown[] };

    return { success: true, data: { projects: data.values } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Confluence Tools ────────────────────────────────────────────────────────

async function searchConfluencePages(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const maxResults = Number(params.maxResults ?? 10);
    const spaceKey = params.spaceKey
      ? `+AND+space.key="${String(params.spaceKey)}"`
      : "";
    const cql = encodeURIComponent(
      `type=page AND text~"${String(params.query)}"${spaceKey ? ` AND space.key="${String(params.spaceKey)}"` : ""}`
    );

    const data = (await atlasFetch(
      baseUrl,
      `/wiki/rest/api/content/search?cql=${cql}&limit=${maxResults}&expand=body.storage,version`,
      auth
    )) as { results: unknown[]; totalSize: number };

    return {
      success: true,
      data: { pages: data.results, total: data.totalSize },
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getConfluencePage(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const pageId = String(params.pageId);

    const data = await atlasFetch(
      baseUrl,
      `/wiki/rest/api/content/${pageId}?expand=body.storage,version,space`,
      auth
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function createConfluencePage(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);

    const payload: Record<string, unknown> = {
      type: "page",
      title: String(params.title),
      space: { key: String(params.spaceKey) },
      body: {
        storage: {
          value: String(params.content),
          representation: "storage",
        },
      },
    };

    if (params.parentId) {
      payload.ancestors = [{ id: String(params.parentId) }];
    }

    const data = await atlasFetch(baseUrl, "/wiki/rest/api/content", auth, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function updateConfluencePage(
  params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);
    const pageId = String(params.pageId);

    const current = (await atlasFetch(
      baseUrl,
      `/wiki/rest/api/content/${pageId}?expand=version`,
      auth
    )) as { version: { number: number }; title: string };

    const payload = {
      type: "page",
      title: params.title ? String(params.title) : current.title,
      version: { number: current.version.number + 1 },
      body: {
        storage: {
          value: String(params.content),
          representation: "storage",
        },
      },
    };

    const data = await atlasFetch(
      baseUrl,
      `/wiki/rest/api/content/${pageId}`,
      auth,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );

    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function listConfluenceSpaces(
  _params: Record<string, unknown>,
  ctx: ConnectorContext
): Promise<ToolCallResult> {
  try {
    const { baseUrl, auth } = getAtlassianAuth(ctx);

    const data = (await atlasFetch(
      baseUrl,
      "/wiki/rest/api/space?limit=50&type=global",
      auth
    )) as { results: unknown[] };

    return { success: true, data: { spaces: data.results } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Connector exports ────────────────────────────────────────────────────────

export const jiraConnector: Connector = {
  appId: "jira",
  tools: {
    search_issues: searchJiraIssues,
    get_issue: getJiraIssue,
    create_issue: createJiraIssue,
    update_issue: updateJiraIssue,
    list_projects: listJiraProjects,
  },
};

export const confluenceConnector: Connector = {
  appId: "confluence",
  tools: {
    search_pages: searchConfluencePages,
    get_page: getConfluencePage,
    create_page: createConfluencePage,
    update_page: updateConfluencePage,
    list_spaces: listConfluenceSpaces,
  },
};
