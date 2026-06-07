import { describe, expect, it } from "vitest";
import { ENVIRONMENT_GROUP_MAP } from "@/lib/m365/groups";

describe("Environment Access Control", () => {
  describe("ENVIRONMENT_GROUP_MAP", () => {
    it("should have non-empty groups for all environments", () => {
      expect(ENVIRONMENT_GROUP_MAP.production.length).toBeGreaterThan(0);
      expect(ENVIRONMENT_GROUP_MAP.staging.length).toBeGreaterThan(0);
      expect(ENVIRONMENT_GROUP_MAP.local.length).toBeGreaterThan(0);
    });

    it("should use valid group IDs (UUID format)", () => {
      const allGroups = Object.values(ENVIRONMENT_GROUP_MAP).flat();
      for (const group of allGroups) {
        expect(group).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it("should isolate production from test environments", () => {
      const productionGroups = new Set(ENVIRONMENT_GROUP_MAP.production);
      const testGroups = new Set([
        ...ENVIRONMENT_GROUP_MAP.staging,
        ...ENVIRONMENT_GROUP_MAP.local,
      ]);

      const intersection = productionGroups.intersection(testGroups);
      expect(intersection.size).toBe(0);
    });
  });
});
