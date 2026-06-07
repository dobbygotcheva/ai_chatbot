import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import AzureAD from "next-auth/providers/azure-ad";
import {
  deleteMcpSessionByUserId,
  getUserByAzureAd,
  upsertUserByAzureAd,
} from "@/lib/db/queries";
import type { Permission } from "@/lib/db/schema";
import {
  augmentGroupsWithEmailOverride,
  mapGroupsToPermissions,
  validateEnvironmentAccess,
} from "@/lib/m365/groups";
import { removeSessionByUserId } from "@/lib/mcp/client";
import { config } from "@/shared/config";
import { authConfig } from "./auth.config";

/**
 * Refresh Microsoft access token using refresh token
 */
async function refreshMicrosoftToken(
  token: Record<string, unknown>,
  clientId: string,
  clientSecret: string,
  tenantId: string
): Promise<void> {
  const refreshToken = token.refreshToken as string | undefined;
  if (!refreshToken) {
    return;
  }

  try {
    const response = await fetch(
      `${config.auth.m365BaseUrl}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "openid profile email User.Read GroupMember.Read.All",
        }).toString(),
      }
    );

    if (response.ok) {
      const tokens = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      token.accessToken = tokens.access_token;
      token.refreshToken = tokens.refresh_token ?? refreshToken;
      token.accessTokenExpires = Date.now() + tokens.expires_in * 1000;
    } else {
      const errorBody = await response.text();
      console.error("Microsoft token refresh failed:", {
        status: response.status,
        statusText: response.statusText,
        tenantId,
        clientId: `${clientId.slice(0, 8)}...`,
        hasRefreshToken: !!refreshToken,
        errorBody: errorBody.slice(0, 500),
      });
      token.accessToken = undefined;
      token.refreshToken = undefined;
    }
  } catch (error) {
    console.error("Microsoft token refresh failed:", {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
      clientId: `${clientId.slice(0, 8)}...`,
      hasRefreshToken: !!refreshToken,
    });
  }
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      azureAdId: string;
      groups: string[];
      permissions: Permission[];
      picture?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    azureAdId: string;
    groups: string[];
    permissions: Permission[];
    picture?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    azureAdId: string;
    groups: string[];
    permissions: Permission[];
    picture?: string | null;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

/**
 * Fetch user's M365 security groups from Graph API
 * Uses delegated flow with user's access token
 * Requires: GroupMember.Read.All (delegated) - already configured in Azure AD
 */
async function fetchUserGroups(
  azureAdId: string,
  userAccessToken: string
): Promise<string[]> {
  try {
    const graphUrl = `${config.azure.graphApiUrl}/me/memberOf/microsoft.graph.group?$select=id,displayName`;
    console.log("Fetching groups for user:", azureAdId);

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseBody = await response.text();
    console.log("Graph API response status:", response.status);

    if (!response.ok) {
      console.error(
        "Failed to fetch user groups from Graph API:",
        responseBody
      );
      return [];
    }

    const data = JSON.parse(responseBody) as {
      value: Array<{ id: string; displayName: string }>;
    };

    console.log("Groups fetched:", data.value?.length || 0);
    // Return group IDs (GUIDs) for permission mapping - more stable than names
    return data.value?.map((g) => g.id) || [];
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return [];
  }
}

// Validate Azure AD configuration before initializing NextAuth
if (
  !config.azure.adTenantId ||
  !config.azure.adClientId ||
  !config.azure.adClientSecret
) {
  console.error(
    "❌ Azure AD configuration missing. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, and AZURE_AD_CLIENT_SECRET"
  );
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  secret: config.auth.secret,
  trustHost: true,
  // Use secure cookies only when AUTH_URL starts with https://
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: config.auth.url?.startsWith("https://") ?? false,
      },
    },
  },
  providers: [
    AzureAD({
      clientId: config.azure.adClientId,
      clientSecret: config.azure.adClientSecret,
      // Explicitly use tenant-specific endpoints (not /common)
      // This fixes AADSTS50194 error for single-tenant apps
      authorization: {
        url: `${config.auth.m365BaseUrl}/oauth2/v2.0/authorize`,
        params: {
          scope: "openid profile email User.Read GroupMember.Read.All",
          prompt: "select_account",
        },
      },
      token: `${config.auth.m365BaseUrl}/oauth2/v2.0/token`,
      // Disable PKCE - Both useless and broken on our setup
      checks: [],
    }),
  ],
  session: {
    strategy: "jwt",
    // 4 hours - forces periodic re-login to refresh permissions from Azure AD
    maxAge: 4 * 60 * 60,
  },
  callbacks: {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Authentication callbacks require multiple conditional branches for security and proper token handling
    async jwt({ token, account, user, profile }) {
      try {
        if (account) {
          token.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : 0;
        }

        // Fetch user from DB to get database ID (required for foreign key constraints)
        if ((user || profile) && token.id == null) {
          const identifier = (profile?.sub ||
            user?.azureAdId ||
            user?.email ||
            profile?.email) as string;

          if (!identifier) {
            console.error("JWT callback: No user identifier available");
            return token;
          }

          // Retry logic for database replication lag (up to 2 retries)
          let dbUser: Awaited<ReturnType<typeof getUserByAzureAd>> = null;
          let attempts = 0;
          while (!dbUser && attempts < 2) {
            if (attempts > 0) {
              console.log(
                `JWT callback: User not found, retrying (${attempts}/2)...`,
                identifier
              );
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            dbUser = await getUserByAzureAd(identifier);
            attempts++;
          }

          if (!dbUser) {
            console.error(
              "JWT callback: User not found in DB after retries. identifier:",
              identifier
            );
            throw new Error("User not found in database after sign-in");
          }

          token.id = dbUser.id;
          token.azureAdId = dbUser.azureAdId || identifier;
          token.email = dbUser.email || "";
          token.groups = [];
          token.permissions = dbUser.permissions || [];
          token.picture = dbUser.picture || (profile?.picture as string) || "";
        }

        if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
          return token;
        }

        if (
          token.refreshToken &&
          config.azure.adClientId &&
          config.azure.adClientSecret
        ) {
          await refreshMicrosoftToken(
            token,
            config.azure.adClientId,
            config.azure.adClientSecret,
            config.azure.adTenantId ?? "organizations"
          );
        }
        return token;
      } catch (error) {
        console.error(">>> JWT CALLBACK ERROR:", error);
        throw error;
      }
    },
    redirect({ url, baseUrl }) {
      if (url.includes("/api/auth/callback")) {
        return baseUrl;
      }
      if (url.startsWith("/")) {
        return url;
      }
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl;
    },
    session({ session, token }) {
      console.log("Session callback triggered with token:", {
        hasToken: !!token,
        hasSession: !!session,
        hasUser: !!session.user,
      });

      // Ensure session.user exists (required for JWT strategy)
      if (!session.user) {
        session.user = {
          id: "",
          email: "",
          emailVerified: null,
          azureAdId: "",
          groups: [],
          permissions: [],
          name: null,
          image: null,
        };
      }

      // Augment session.user with M365 properties from JWT
      session.user.id = token.id;
      session.user.azureAdId = token.azureAdId;
      session.user.email = token.email ?? "";
      session.user.groups = token.groups || [];
      session.user.permissions = token.permissions || [];
      session.user.picture = token.picture;

      console.log("Session callback completed, returning session", {
        userId: session.user.id,
        note: "groups/permissions fetched from DB on-demand",
      });
      return session;
    },
    async signIn({ profile, account }) {
      if (account?.provider !== "azure-ad") {
        return false;
      }

      // Upsert user in database with M365 profile info
      const azureAdId = profile?.sub as string;
      const email = profile?.email as string;
      const name = profile?.name as string;
      const picture = profile?.picture as string;

      if (!azureAdId || !email) {
        console.error("Missing required M365 profile fields");
        return false;
      }

      // Fetch user groups from Graph API and convert to permissions
      // Requires: GroupMember.Read.All (delegated) - already configured in Azure AD
      let permissions: Permission[] = [];

      if (!account.access_token) {
        console.error("No access token available for groups fetch");
        return false;
      }

      try {
        const m365Groups = await fetchUserGroups(
          azureAdId,
          account.access_token
        );
        const allGroups = augmentGroupsWithEmailOverride(m365Groups, email);

        validateEnvironmentAccess(allGroups);

        permissions = mapGroupsToPermissions(allGroups);
        console.log("Upserting user:", email, "groups:", allGroups);
      } catch (error) {
        console.error(
          "Failed to fetch groups or environment access denied:",
          error
        );
        throw new Error("AccessDenied");
      }

      try {
        await upsertUserByAzureAd({
          azureAdId,
          email,
          name,
          picture,
          permissions,
        });
        console.log("User upserted successfully");
      } catch (error) {
        console.error("Failed to upsert user in database:", error);
        return false;
      }

      console.log("Sign in completed successfully, redirecting...");
      return true;
    },
  },
  events: {
    async signOut(data) {
      // Get user ID from token (JWT) or session (database)
      let userId: string | undefined;
      if ("token" in data && data.token) {
        userId = data.token.id as string;
      } else if ("session" in data) {
        const sessionData = data.session as
          | { user?: { id?: string } }
          | undefined;
        userId = sessionData?.user?.id;
      }
      if (userId) {
        try {
          removeSessionByUserId(userId);
        } catch (error) {
          console.error(
            "Failed to remove in-memory MCP session on signout:",
            error
          );
        }

        try {
          await deleteMcpSessionByUserId({ userId });
        } catch (error) {
          console.error(
            "Failed to delete database MCP sessions on signout:",
            error
          );
        }
      }
    },
  },
});
