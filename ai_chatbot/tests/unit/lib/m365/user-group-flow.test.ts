import { describe, expect, it } from "vitest";
import { GROUP_NAME_TO_ID, mapGroupsToPermissions } from "@/lib/m365/groups";

const ID_USERS = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-USERS"];
const ID_LLM = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-LLM-USERS"];
const ID_TEST_USERS = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-USERS"];
const ID_TEST_LLM = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-TEST-LLM-USERS"];
const ID_ADMIN = GROUP_NAME_TO_ID["SG-EGT-AI-CENTER-ADMIN-TEMPORARY"];

describe("User Group Permission Flow", () => {
  describe("New User First Login", () => {
    it("should deny all access when user is not in any configured group", () => {
      const userGroups = ["00000000-0000-0000-0000-000000000999"];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toEqual([]);
      expect(permissions.includes("tools")).toBe(false);
      expect(permissions.includes("llm")).toBe(false);
      expect(permissions.includes("metrics")).toBe(false);
    });
  });

  describe("User Group Membership Changes", () => {
    it("should grant metrics access when user is added to admin group", () => {
      const userGroups = [ID_USERS, ID_ADMIN];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions.includes("metrics")).toBe(true);
      expect(permissions.includes("tools")).toBe(true);
      expect(permissions.includes("llm")).toBe(false);
    });

    it("should maintain access when user is in multiple overlapping groups", () => {
      const userGroups = [ID_USERS, ID_TEST_USERS];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toEqual(["tools"]);
    });

    it("should deny all access when user is removed from all groups", () => {
      const userGroups: string[] = [];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toEqual([]);
    });
  });

  describe("Test vs Production Environment", () => {
    it("should grant same permissions for test and production users", () => {
      const prodUserGroups = [ID_USERS];
      const testUserGroups = [ID_TEST_USERS];

      const prodPermissions = mapGroupsToPermissions(prodUserGroups);
      const testPermissions = mapGroupsToPermissions(testUserGroups);

      expect(prodPermissions).toEqual(testPermissions);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user in all groups", () => {
      const userGroups = [
        ID_USERS,
        ID_LLM,
        ID_TEST_USERS,
        ID_TEST_LLM,
        ID_ADMIN,
      ];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toContain("tools");
      expect(permissions).toContain("llm");
      expect(permissions).toContain("metrics");
      expect(permissions.length).toBe(3);
    });

    it("should handle duplicate group IDs gracefully", () => {
      const userGroups = [ID_USERS, ID_USERS];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toEqual(["tools"]);
    });

    it("should deny access when group ID has extra whitespace (no match)", () => {
      const userGroups = [` ${ID_USERS} `];
      const permissions = mapGroupsToPermissions(userGroups);

      expect(permissions).toEqual([]);
    });
  });

  describe("Contractor and External User Scenarios", () => {
    it("should restrict contractor to LLM-only access", () => {
      const contractorGroups = [ID_LLM];
      const permissions = mapGroupsToPermissions(contractorGroups);

      expect(permissions).toEqual(["llm"]);
      expect(permissions.includes("tools")).toBe(false);
    });

    it("should allow external auditor to view metrics only", () => {
      const auditorGroups = [ID_ADMIN];
      const permissions = mapGroupsToPermissions(auditorGroups);

      expect(permissions).toEqual(["metrics"]);
      expect(permissions.includes("tools")).toBe(false);
      expect(permissions.includes("llm")).toBe(false);
    });
  });
});
