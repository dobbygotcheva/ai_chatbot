import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import {
  currentDateInputSchema,
  getCurrentDate,
} from "@/lib/ai/tools/get-current-date";

interface DateResult {
  isoString?: string;
  timezone?: string;
  formattedDate?: string;
  formattedTime?: string;
  dayOfWeek?: string;
  error?: string;
}

const dateTool = getCurrentDate as Tool & {
  execute: (input: { timezone?: string }) => Promise<DateResult>;
};

describe("getCurrentDate tool", () => {
  it("should have valid input schema", () => {
    const validEmpty = currentDateInputSchema.safeParse({});
    expect(validEmpty.success).toBe(true);

    const validTimezone = currentDateInputSchema.safeParse({
      timezone: "America/New_York",
    });
    expect(validTimezone.success).toBe(true);
  });

  it("should return current date in UTC by default", async () => {
    const result = await dateTool.execute({});

    expect(result).toHaveProperty("isoString");
    expect(result).toHaveProperty("timezone", "UTC");
    expect(result).toHaveProperty("formattedDate");
    expect(result).toHaveProperty("formattedTime");
    expect(result).toHaveProperty("dayOfWeek");

    const today = new Date();
    expect(result.formattedDate).toBe(today.toISOString().split("T")[0]);
  });

  it("should return date in specified timezone", async () => {
    const result = await dateTool.execute({ timezone: "America/New_York" });

    expect(result).toHaveProperty("timezone", "America/New_York");
    expect(result).toHaveProperty("formattedDate");
  });

  it("should handle invalid timezone", async () => {
    const result = await dateTool.execute({ timezone: "Invalid/Timezone" });

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Invalid timezone");
  });
});
