// Centralized Configuration
// Single source of truth for all environment variables
// Validated at runtime (lazy loading), never access process.env elsewhere

import { z } from "zod";
import { GROUP_NAME_TO_ID, GROUP_PERMISSION_MAP } from "@/lib/m365/groups";

// Default embedding model name used by both AI provider and Qdrant
const DEFAULT_EMBEDDING_MODEL = "embedding";

const configSchema = z.object({
  // ─── Database ────────────────────────────────────────────────────────────────
  database: z.object({
    url: z.string().min(1, "POSTGRES_URL is required"),
  }),

  // ─── AI Provider ─────────────────────────────────────────────────────────────
  ai: z.object({
    providerApiKey: z.string().min(1, "PROVIDER_API_KEY is required"),
    providerBaseUrl: z.string().min(1, "PROVIDER_BASE_URL is required"),
    providerModel: z.string().min(1, "PROVIDER_MODEL is required"),
    reasoningModel: z.string().optional(),
    titleModel: z.string().optional(),
    artifactModel: z.string().optional(),
    embeddingModel: z
      .string()
      .default(process.env.QDRANT_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL),
  }),

  // ─── Vector Search (Qdrant) ──────────────────────────────────────────────────
  vector: z.object({
    url: z.string().min(1, "QDRANT_URL is required"),
    dimensions: z.coerce
      .number()
      .default(() => Number(process.env.QDRANT_VECTOR_DIM ?? 1024)),
    embeddingModel: z
      .string()
      .default(process.env.QDRANT_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL),
    apiKey: z.string().optional(),
  }),

  // ─── Authentication ──────────────────────────────────────────────────────────
  auth: z.object({
    secret: z.string().min(1, "AUTH_SECRET is required"),
    url: z.string().optional(),
    m365BaseUrl: z.string().optional(),
    // Email-to-groups override for granting additional permissions via environment
    // Format: email=GROUP1|GROUP2;email=GROUP3;email=GROUP4|GROUP5
    // Same email can appear multiple times to accumulate groups
    // Only groups from GROUP_PERMISSION_MAP are allowed
    emailGroups: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) {
          return {};
        }

        // Accept both names and ID to support readable env overrides
        const validGroups = [
          ...Object.keys(GROUP_PERMISSION_MAP),
          ...Object.keys(GROUP_NAME_TO_ID),
        ];

        const result: Record<string, string[]> = {};
        const entries = val.split(";");
        const errors: Array<{
          type: "invalid-group" | "invalid-format";
          email?: string;
          group?: string;
          entry?: string;
        }> = [];

        for (const entry of entries) {
          const trimmedEntry = entry.trim();
          if (!trimmedEntry) {
            continue;
          }

          const parts = trimmedEntry.split("=");
          if (parts.length !== 2) {
            errors.push({ type: "invalid-format", entry: trimmedEntry });
            continue;
          }

          const [email, groupsStr] = parts;
          if (!email || !groupsStr) {
            errors.push({ type: "invalid-format", entry: trimmedEntry });
            continue;
          }

          const groups = groupsStr.split("|").filter((g) => g.length > 0);
          if (groups.length === 0) {
            errors.push({ type: "invalid-format", entry: trimmedEntry });
            continue;
          }

          // Validate groups against allowed list
          for (const group of groups) {
            if (validGroups.includes(group)) {
              // Accumulate groups if email appears multiple times
              result[email] = [...(result[email] || []), group];
            } else {
              errors.push({ type: "invalid-group", email, group });
            }
          }
        }

        // Fail validation if any errors found
        if (errors.length > 0) {
          const errorMessages = errors.map((error) => {
            if (error.type === "invalid-format") {
              return `  - Invalid format: "${error.entry}" (expected: email=GROUP1|GROUP2)`;
            }
            return `  - Invalid group "${error.group}" for ${error.email}`;
          });
          throw new Error(
            `AUTH_EMAIL_GROUPS validation failed:\n${errorMessages.join("\n")}\n\nValid groups are: ${validGroups.join(", ")}\nFormat: email=GROUP1|GROUP2;email2=GROUP3`
          );
        }

        return result;
      }),
  }),

  // ─── Application Settings ────────────────────────────────────────────────────
  app: z.object({
    env: z.enum(["development", "production", "test"]).default("development"),
    port: z.coerce.number().default(3000),
    isDevelopment: z.boolean().default(false),
    isProduction: z.boolean().default(false),
    isTest: z.boolean().default(false),
    environment: z.enum(["production", "staging", "local"]).default("local"),
  }),

  // ─── Redis (optional) ────────────────────────────────────────────────────────
  // Used for: SSE streaming, caching, rate limiting
  redis: z.object({
    url: z.string().optional(),
  }),

  // ─── Web Crawler (optional) ──────────────────────────────────────────────────
  // Used for: Web search functionality via Crawl4AI service
  crawler: z.object({
    url: z.string().optional(),
  }),

  // ─── SearXNG (optional) ──────────────────────────────────────────────────────
  // Used for: Privacy-respecting web search via SearXNG metasearch engine
  searxng: z.object({
    url: z.string().optional(),
  }),

  // ─── Code Execution (optional) ───────────────────────────────────────────────
  // Used for: Sandboxed code execution service
  codeExecution: z
    .object({
      serviceUrl: z
        .string()
        .default(
          process.env.CODE_EXECUTION_SERVICE_URL ?? "http://localhost:5001"
        ),
      timeout: z.coerce.number().default(30_000),
    })
    .default({
      serviceUrl:
        process.env.CODE_EXECUTION_SERVICE_URL ?? "http://localhost:5001",
      timeout: 30_000,
    }),

  // ─── MCP Integrations (optional) ─────────────────────────────────────────────
  // Model Context Protocol connectors for external services
  mcp: z.object({
    atlassian: z.string().optional(), // Atlassian MCP server URL
  }),

  // ─── Encryption ──────────────────────────────────────────────────────────────
  // Used for: Encrypting sensitive data (API tokens, credentials)
  encryption: z.object({
    key: z.string().min(1, "ENCRYPTION_KEY is required"),
  }),

  // ─── Azure AD (optional) ─────────────────────────────────────────────────────
  // Used for: Microsoft Graph MCP connector (Teams, SharePoint, OneDrive, Outlook)
  // Provide all three credentials together, or leave all empty
  azure: z.object({
    adTenantId: z.string().optional(),
    adClientId: z.string().optional(),
    adClientSecret: z.string().optional(),
    graphApiUrl: z.string().optional(),
  }),

  // ─── Testing (optional) ──────────────────────────────────────────────────────
  test: z.object({
    playwrightTestBaseUrl: z.string().optional(),
    playwright: z.string().optional(),
    ciPlaywright: z.string().optional(),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Detect environment for access control (called once at config load time)
 * Uses M365_BASE_URL and AUTH_URL to determine environment
 */
function detectEnvironment(
  m365BaseUrl: string | undefined,
  authUrl: string | undefined
): "production" | "staging" | "local" {
  const isMockServer = m365BaseUrl?.includes("localhost");

  if (isMockServer) {
    return "local";
  }

  const authUrlLower = authUrl?.toLowerCase() ?? "";
  if (authUrlLower.includes("-test")) {
    return "staging";
  }

  // Default to production
  return "production";
}

function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const result = configSchema.safeParse({
    database: {
      url: process.env.POSTGRES_URL,
    },
    ai: {
      providerApiKey: process.env.PROVIDER_API_KEY,
      providerBaseUrl: process.env.PROVIDER_BASE_URL,
      providerModel: process.env.PROVIDER_MODEL,
      reasoningModel: process.env.PROVIDER_REASONING_MODEL,
      titleModel: process.env.PROVIDER_TITLE_MODEL,
      artifactModel: process.env.PROVIDER_ARTIFACT_MODEL,
      embeddingModel: process.env.PROVIDER_EMBEDDING_MODEL ?? "embedding",
    },
    vector: {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      dimensions: process.env.QDRANT_VECTOR_DIM,
      embeddingModel: process.env.QDRANT_EMBEDDING_MODEL,
    },
    auth: {
      secret: process.env.AUTH_SECRET?.trim(),
      url: process.env.AUTH_URL,
      m365BaseUrl:
        process.env.M365_BASE_URL ??
        (process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
          ? "http://localhost:8080"
          : `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`),
      emailGroups: process.env.AUTH_EMAIL_GROUPS,
    },
    app: {
      env: nodeEnv,
      port: process.env.PORT,
      isDevelopment: nodeEnv === "development",
      isProduction: nodeEnv === "production",
      isTest: nodeEnv === "test",
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    crawler: {
      url: process.env.CRAWLER_URL,
    },
    searxng: {
      url: process.env.SEARXNG_URL,
    },
    mcp: {
      atlassian: process.env.ATLASSIAN_MCP,
    },
    encryption: {
      key: process.env.ENCRYPTION_KEY,
    },
    azure: {
      adTenantId: process.env.AZURE_AD_TENANT_ID,
      adClientId: process.env.AZURE_AD_CLIENT_ID,
      adClientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      graphApiUrl: process.env.AZURE_GRAPH_API_URL,
    },
    test: {
      playwrightTestBaseUrl: process.env.PLAYWRIGHT_TEST_BASE_URL,
      playwright: process.env.PLAYWRIGHT,
      ciPlaywright: process.env.CI_PLAYWRIGHT,
    },
  });

  if (!result.success) {
    console.error("❌ Configuration validation failed:");
    for (const err of result.error.errors) {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    }
    process.exit(1);
  }

  const data = result.data;

  // Validate Azure AD credentials: allow all or nothing
  const { adTenantId, adClientId, adClientSecret } = data.azure;
  const hasSomeAzureCreds = adTenantId || adClientId || adClientSecret;
  const hasAllAzureCreds = adTenantId && adClientId && adClientSecret;
  if (hasSomeAzureCreds && !hasAllAzureCreds) {
    console.error("❌ Azure AD configuration incomplete:");
    console.error(
      "  Provide all three credentials (AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET) or leave all empty"
    );
    process.exit(1);
  }

  const isMockServer = data.auth.m365BaseUrl?.includes("localhost");
  data.azure.graphApiUrl =
    process.env.AZURE_GRAPH_API_URL ??
    (isMockServer
      ? `${data.auth.m365BaseUrl}`
      : "https://graph.microsoft.com/v1.0");

  // Set environment for access control (determined once at load time)
  data.app.environment = detectEnvironment(
    data.auth.m365BaseUrl,
    data.auth.url
  );

  return data;
}

// Lazy-loaded singleton config instance
// Uses Proxy to defer loading until first property access
let _config: Config | null = null;

function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
    Object.freeze(_config);
  }
  return _config;
}

// Proxy-based lazy config export
// This allows `config.foo.bar` syntax while deferring actual loading
export const config = new Proxy<Config>({} as Config, {
  get(_target, prop) {
    const cfg = getConfig();
    return cfg[prop as keyof Config];
  },
  has(_target, prop) {
    const cfg = getConfig();
    return prop in cfg;
  },
  ownKeys() {
    const cfg = getConfig();
    return Reflect.ownKeys(cfg);
  },
  getOwnPropertyDescriptor() {
    getConfig();
    return { enumerable: true, configurable: false, writable: false };
  },
  // Prevent any modifications to the config object
  set(_target, prop, _value) {
    throw new TypeError(
      `Cannot set property "${String(prop)}" on config object - config is read-only`
    );
  },
  defineProperty(_target, prop, _descriptor) {
    throw new TypeError(
      `Cannot define property "${String(prop)}" on config object - config is read-only`
    );
  },
  deleteProperty(_target, prop) {
    throw new TypeError(
      `Cannot delete property "${String(prop)}" on config object - config is read-only`
    );
  },
  setPrototypeOf(_target, _proto) {
    throw new TypeError(
      "Cannot set prototype on config object - config is read-only"
    );
  },
  preventExtensions() {
    // Already non-extensible by design
    return true;
  },
});

// Lazy-loaded VECTOR_DIM constant
// Accessed via getter to defer loading
//
// `toJSON` is required because JSON.stringify ignores valueOf/Symbol.toPrimitive
// for non-primitive values; without it, callers like the Qdrant client would
// serialize this as `{}` and Qdrant rejects the resulting VectorsConfig body.
export const VECTOR_DIM = {
  valueOf(): number {
    return getConfig().vector.dimensions;
  },
  toString(): string {
    return String(getConfig().vector.dimensions);
  },
  toJSON(): number {
    return getConfig().vector.dimensions;
  },
  [Symbol.toPrimitive](hint: string): number | string {
    const dim = getConfig().vector.dimensions;
    return hint === "string" ? String(dim) : dim;
  },
} as unknown as number;
