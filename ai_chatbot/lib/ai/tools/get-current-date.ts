import { tool } from "ai";
import { z } from "zod";

export const currentDateInputSchema = z.object({
  timezone: z
    .string()
    .describe(
      "Optional timezone (e.g., 'UTC', 'America/New_York', 'Europe/London'). If not provided, returns UTC time."
    )
    .optional(),
});

export const getCurrentDate = tool({
  description:
    "Get the current date and time. Returns the current date in ISO 8601 format along with timezone information.",
  inputSchema: currentDateInputSchema,
  needsApproval: false,
  execute: (input) => {
    const now = new Date();

    if (input.timezone) {
      try {
        // Convert to the specified timezone
        const options: Intl.DateTimeFormatOptions = {
          timeZone: input.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        };

        const formatter = new Intl.DateTimeFormat("en-US", options);
        const parts = formatter.formatToParts(now);

        const partMap: Record<string, string> = {};
        for (const part of parts) {
          partMap[part.type] = part.value;
        }

        return {
          isoString: now.toISOString(),
          timezone: input.timezone,
          formattedDate: `${partMap.year}-${partMap.month}-${partMap.day}`,
          formattedTime: `${partMap.hour}:${partMap.minute}:${partMap.second}`,
          dayOfWeek: new Intl.DateTimeFormat("en-US", {
            timeZone: input.timezone,
            weekday: "long",
          }).format(now),
        };
      } catch {
        return {
          error: `Invalid timezone: "${input.timezone}". Please use a valid IANA timezone name (e.g., 'UTC', 'America/New_York').`,
        };
      }
    }

    // Return UTC time by default
    return {
      isoString: now.toISOString(),
      timezone: "UTC",
      formattedDate: now.toISOString().split("T")[0],
      formattedTime: now.toISOString().split("T")[1].split(".")[0],
      dayOfWeek: new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        weekday: "long",
      }).format(now),
    };
  },
});
