/**
 * Mock M365 Auth Server - Constants
 *
 * Centralized constants and mock data for the authentication server.
 */

/**
 * Server port configuration
 */
export const PORT = 8080;

/**
 * Token expiry time in seconds (1 hour)
 */
export const TOKEN_EXPIRY_SECONDS = 3600;

export const MOCK_USER_ADMIN = {
  sub: "admin-uuid",
  email: "admin@mail.com",
  name: "Admin User",
  picture: null,
} as const;

export const MOCK_USER_DEV = {
  sub: "dev-uuid",
  email: "dev@mail.com",
  name: "Developer User",
  picture: null,
} as const;

export const GROUP_NAME_TO_ID: Record<string, string> = {
  "SG-EGT-AI-CENTER-USERS": "80f03480-2b30-485d-998a-1c6d0ff84a26",
  "SG-EGT-AI-CENTER-TEST-USERS": "2b4db468-4e5a-4860-b9c2-5ff66025485a",
  "SG-EGT-AI-CENTER-LLM-USERS": "9a3cf15a-c80f-4c14-8b2e-0f49f0105a35",
  "SG-EGT-AI-CENTER-TEST-LLM-USERS": "d5271f4c-3235-4263-b839-1500f0cfc5bc",
  "SG-EGT-AI-CENTER-ADMIN-TEMPORARY": "ADMIN-TEMP-GROUP",
};

export const ID_TO_GROUP_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_NAME_TO_ID).map(([name, id]) => [id, name])
);

function groupEntry(name: string): { id: string; displayName: string } {
  return { id: GROUP_NAME_TO_ID[name], displayName: name };
}

export const MOCK_GROUP_MEMBERSHIP_ADMIN = {
  value: [
    groupEntry("SG-EGT-AI-CENTER-USERS"),
    groupEntry("SG-EGT-AI-CENTER-TEST-USERS"),
    groupEntry("SG-EGT-AI-CENTER-ADMIN-TEMPORARY"),
  ],
} as const;

export const MOCK_GROUP_MEMBERSHIP_DEV = {
  value: [
    groupEntry("SG-EGT-AI-CENTER-TEST-USERS"),
    groupEntry("SG-EGT-AI-CENTER-TEST-LLM-USERS"),
  ],
} as const;
