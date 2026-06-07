import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const executeRequestSchema = z.object({
  code: z
    .string()
    .max(102400, "Code must be less than 100KB (102400 characters)"),
  language: z.enum(["python", "javascript", "bash"], {
    errorMap: () => ({
      message: "Language must be python, javascript, or bash",
    }),
  }),
  timeout: z
    .number()
    .min(1000, "Timeout must be at least 1000ms")
    .max(60000, "Timeout must be at most 60000ms")
    .optional()
    .default(30000),
});

export type ExecuteRequest = z.infer<typeof executeRequestSchema>;

export function validateExecuteRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = executeRequestSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  req.body = result.data;
  return next();
}
