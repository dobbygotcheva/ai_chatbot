/**
 * Unit tests for email-based group override functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUP_NAME_TO_ID } from "@/lib/m365/groups";
import { stubRequiredEnvVars } from "@/tests/test-utils";

const ID_USERS = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-USERS"];
const ID_LLM = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-LLM-USERS"];
const ID_ADMIN = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-ADMIN-TEMPORARY"];
const ID_TEST_USERS = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-USERS"];
const ID_TEST_LLM = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-LLM-USERS"];

describe("augmentGroupsWithEmailOverride", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  describe("with no group overrides configured", () => {
    beforeEach(() => {
      stubRequiredEnvVars();
      vi.resetModules();
    });

    it("should return original groups when no email override is configured", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const m365Groups = [ID_USERS];
      const result = augmentGroupsWithEmailOverride(
        m365Groups,
        "user@example.com"
      );

      expect(result).toEqual(m365Groups);
    });

    it("should return empty array when user has no M365 groups and no override", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const result = augmentGroupsWithEmailOverride([], "user@example.com");

      expect(result).toEqual([]);
    });
  });

  describe("with group overrides configured", () => {
    beforeEach(() => {
      stubRequiredEnvVars();
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-ADMIN-TEMPORARY|SG-EGT-AI-CENTER-USERS;dev@example.com=SG-EGT-AI-CENTER-TEST-USERS|SG-EGT-AI-CENTER-TEST-LLM-USERS"
      );
      vi.resetModules();
    });

    it("should add override groups for matching email", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const m365Groups = [ID_USERS];
      const result = augmentGroupsWithEmailOverride(
        m365Groups,
        "admin@example.com"
      );

      expect(result).toEqual([ID_USERS, ID_ADMIN]);
    });

    it("should return only M365 groups for non-matching email", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const m365Groups = [ID_USERS];
      const result = augmentGroupsWithEmailOverride(
        m365Groups,
        "other@example.com"
      );

      expect(result).toEqual([ID_USERS]);
    });

    it("should add override groups even when user has no M365 groups", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const m365Groups: string[] = [];
      const result = augmentGroupsWithEmailOverride(
        m365Groups,
        "admin@example.com"
      );

      expect(result).toEqual([ID_ADMIN, ID_USERS]);
    });

    it("should remove duplicates when override groups overlap with M365 groups", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const m365Groups = [ID_USERS, "tools"];
      const result = augmentGroupsWithEmailOverride(
        m365Groups,
        "admin@example.com"
      );

      expect(result).toEqual([ID_USERS, "tools", ID_ADMIN]);
    });

    it("should handle multiple emails with different overrides", async () => {
      const { augmentGroupsWithEmailOverride } = await import(
        "@/lib/m365/groups"
      );

      const adminResult = augmentGroupsWithEmailOverride(
        [ID_USERS],
        "admin@example.com"
      );
      const devResult = augmentGroupsWithEmailOverride([], "dev@example.com");

      expect(adminResult).toEqual([ID_USERS, ID_ADMIN]);
      expect(devResult).toEqual([ID_TEST_USERS, ID_TEST_LLM]);
    });
  });

  describe("integration with mapGroupsToPermissions", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.unstubAllEnvs();
      stubRequiredEnvVars();
      vi.stubEnv(
        "AUTH_EMAIL_GROUPS",
        "admin@example.com=SG-EGT-AI-CENTER-ADMIN-TEMPORARY;dev@example.com=SG-EGT-AI-CENTER-TEST-USERS"
      );
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetAllMocks();
      vi.unstubAllEnvs();
    });

    it("should grant permissions from both M365 and override groups", async () => {
      const { augmentGroupsWithEmailOverride, mapGroupsToPermissions } =
        await import("@/lib/m365/groups");

      const m365Groups = [ID_USERS];
      const allGroups = augmentGroupsWithEmailOverride(
        m365Groups,
        "admin@example.com"
      );
      const permissions = mapGroupsToPermissions(allGroups);

      expect(permissions).toContain("tools");
      expect(permissions).toContain("metrics");
      expect(permissions.length).toBe(2);
    });

    it("should grant permissions from override groups only (no M365 groups)", async () => {
      const { augmentGroupsWithEmailOverride, mapGroupsToPermissions } =
        await import("@/lib/m365/groups");

      const m365Groups: string[] = [];
      const allGroups = augmentGroupsWithEmailOverride(
        m365Groups,
        "dev@example.com"
      );
      const permissions = mapGroupsToPermissions(allGroups);

      expect(permissions).toContain("tools");
    });

    it("should grant no permissions when user has no groups and no override", async () => {
      const { augmentGroupsWithEmailOverride, mapGroupsToPermissions } =
        await import("@/lib/m365/groups");

      const m365Groups: string[] = [];
      const allGroups = augmentGroupsWithEmailOverride(
        m365Groups,
        "other@example.com"
      );
      const permissions = mapGroupsToPermissions(allGroups);

      expect(permissions).toEqual([]);
    });

    it("should handle complete flow: M365 + override → permissions", async () => {
      const { augmentGroupsWithEmailOverride, mapGroupsToPermissions } =
        await import("@/lib/m365/groups");

      const m365Groups = [ID_USERS, ID_LLM];

      const allGroups = augmentGroupsWithEmailOverride(
        m365Groups,
        "admin@example.com"
      );

      const permissions = mapGroupsToPermissions(allGroups);

      expect(permissions).toContain("tools");
      expect(permissions).toContain("llm");
      expect(permissions).toContain("metrics");
      expect(permissions.length).toBe(3);
    });
  });
});
