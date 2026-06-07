// Microsoft 365 Group → Permission Mapping
// Maps Azure AD security groups to fine-grained permissions

import type { Permission } from "@/lib/db/schema";
import { config } from "@/shared/config";

/**
 * Name → Azure AD Object ID mapping
 * IT admins: Replace placeholder GUIDs with actual values from Azure AD
 */
export const GROUP_NAME_TO_ID = {
  "SG-EGT-AI-CENTER-USERS": "80f03480-2b30-485d-998a-1c6d0ff84a26",
  "SG-EGT-AI-CENTER-LLM-USERS": "9a3cf15a-c80f-4c14-8b2e-0f49f0105a35",
  "SG-EGT-AI-CENTER-TEST-USERS": "2b4db468-4e5a-4860-b9c2-5ff66025485a",
  "SG-EGT-AI-CENTER-TEST-LLM-USERS": "d5271f4c-3235-4263-b839-1500f0cfc5bc",
  "SG-EGT-AI-CENTER-ADMIN-TEMPORARY": "ADMIN-TEMP-GROUP",
} as const;

type GroupName = keyof typeof GROUP_NAME_TO_ID;

/**
 * Configuration: Map M365 security group IDs to permissions
 */
export const GROUP_PERMISSION_MAP: Record<string, Permission[]> = {
  [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-USERS"]]: ["tools"],
  [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-LLM-USERS"]]: ["llm"],
  [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-USERS"]]: ["tools"],
  [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-LLM-USERS"]]: ["llm"],
  [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-ADMIN-TEMPORARY"]]: ["metrics"],
};

/**
 * Environment access control: Map environments to required M365 group IDs
 *
 * Environment detection:
 * - production: NODE_ENV=production && AUTH_URL matches production domain
 * - staging: NODE_ENV=production && AUTH_URL matches staging domain
 * - local: NODE_ENV=development or NODE_ENV=test
 *
 * Configuration:
 * - SG-EGT-AI-CENTER-USERS: Production access
 * - SG-EGT-AI-CENTER-TEST-USERS: Staging and local development access
 *
 * Users without the required group membership will be denied access at sign-in
 */
export const ENVIRONMENT_GROUP_MAP: Record<string, string[]> = {
  production: [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-USERS"]],
  staging: [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-USERS"]],
  local: [GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-USERS"]],
};

/**
 * Default permissions for users with no mapped groups
 * These apply if user's M365 groups don't match any in GROUP_PERMISSION_MAP
 */
export const DEFAULT_PERMISSIONS: Permission[] = [];

/**
 * Validate user has access to current environment
 * Environment is determined once at config load time (not checked at runtime)
 *
 * @param userGroups - User's M365 group IDs (after email override augmentation)
 * @throws Error if user lacks access to current environment
 */
export function validateEnvironmentAccess(userGroups: string[]): void {
  const currentEnv = config.app.environment;
  const requiredGroups = ENVIRONMENT_GROUP_MAP[currentEnv];

  if (!requiredGroups || requiredGroups.length === 0) {
    return;
  }

  const hasAccess = userGroups.some((group) => requiredGroups.includes(group));

  if (!hasAccess) {
    const groupIdToName: Record<string, string> = Object.fromEntries(
      Object.entries(GROUP_NAME_TO_ID).map(([name, id]) => [id, name])
    );

    throw new Error(
      `Access denied: User lacks required group membership for ${currentEnv} environment. ` +
        `Required groups: ${requiredGroups.map((id) => groupIdToName[id] || id).join(", ")}. ` +
        `User groups: ${userGroups.map((id) => groupIdToName[id] || id).join(", ")}`
    );
  }
}

/**
 * Augment user groups with environment-based overrides
 * Reads AUTH_EMAIL_GROUPS config to grant additional groups to specific users
 */
export function augmentGroupsWithEmailOverride(
  groups: string[],
  email: string
): string[] {
  const emailGroups = config.auth.emailGroups;
  const additionalNames = emailGroups[email] || [];
  const additionalIds = additionalNames.map(
    (name) => GROUP_NAME_TO_ID[name as GroupName] || name
  );

  if (additionalIds.length === 0) {
    return groups;
  }

  return Array.from(new Set([...groups, ...additionalIds]));
}

export function mapGroupsToPermissions(groups: string[]): Permission[] {
  const permissionsSet = new Set<Permission>();

  for (const groupId of groups) {
    const groupPermissions = GROUP_PERMISSION_MAP[groupId];
    if (groupPermissions) {
      for (const perm of groupPermissions) {
        permissionsSet.add(perm);
      }
    }
  }

  if (permissionsSet.size === 0) {
    return DEFAULT_PERMISSIONS;
  }

  return Array.from(permissionsSet);
}
