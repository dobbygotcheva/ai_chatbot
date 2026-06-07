import { z } from "zod";

export const codeExecutionFileSchema = z.object({
  name: z.string(),
  content: z.string(),
  size: z.number(),
});

export const codeExecutionImageSchema = z.object({
  name: z.string(),
  content_type: z.string(),
  content: z.string(),
  artifactId: z.string().optional(),
});

export const codeExecutionResultSchema = z.object({
  execution_id: z.string(),
  success: z.boolean().optional(),
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number().optional(),
  duration_ms: z.number(),
  files: z.array(codeExecutionFileSchema).optional(),
  images: z.array(codeExecutionImageSchema).optional(),
  truncated: z.boolean().optional(),
});

export type CodeExecutionFile = z.infer<typeof codeExecutionFileSchema>;
export type CodeExecutionImage = z.infer<typeof codeExecutionImageSchema>;
export type CodeExecutionResult = z.infer<typeof codeExecutionResultSchema>;

export interface CodeExecutionDisplayProps {
  result: CodeExecutionResult;
  className?: string;
}

/**
 * Safely parse unknown data into CodeExecutionResult
 * Returns null if validation fails
 */
export function parseCodeExecutionResult(
  output: unknown
): CodeExecutionResult | null {
  const result = codeExecutionResultSchema.safeParse(output);
  if (!result.success) {
    console.error(
      "Invalid code execution result:",
      result.error.flatten().fieldErrors
    );
    return null;
  }
  return result.data;
}
