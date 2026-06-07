import { type Request, type Response, Router } from "express";
import { ExecutionError } from "../errors";
import { authMiddleware } from "../middleware/auth";
import { executeLimiter } from "../middleware/rate-limiter";
import { ContainerManager } from "../services/container-manager";
import { executionQueue } from "../services/execution-queue";
import { logger } from "../services/logger";
import {
  type ExecuteRequest,
  validateExecuteRequest,
} from "../validators/execute.schema.js";

const router: ReturnType<typeof Router> = Router();
const containerManager = new ContainerManager();

interface ExecuteResponse {
  execution_id: string;
  status: "success" | "error";
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  files: Array<{ name: string; content: string; size: number }>;
  images: Array<{ name: string; content_type: string; content: string }>;
  truncated: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
}

router.post(
  "/api/execute",
  authMiddleware,
  executeLimiter,
  validateExecuteRequest,
  async (req: Request, res: Response<ExecuteResponse | ErrorResponse>) => {
    const { code, language, timeout } = req.body as ExecuteRequest;

    try {
      const result = await executionQueue.add(async () => {
        const container = await containerManager.createContainer(language);
        const execResult = await containerManager.executeInContainer(
          container,
          code,
          language,
          timeout,
        );
        await containerManager.destroyContainer(container);
        return execResult;
      });

      logger.info({
        execution_id: result.execution_id,
        language,
        duration_ms: result.duration_ms,
        success: result.exit_code === 0,
        message: "Execution completed via API",
      });

      res.json({
        execution_id: result.execution_id,
        status: result.exit_code === 0 ? "success" : "error",
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        duration_ms: result.duration_ms,
        files: result.files,
        images: result.images,
        truncated: result.truncated,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown execution error";
      const errorType =
        error instanceof ExecutionError
          ? (error as ExecutionError).error_type
          : "ExecutionError";

      logger.error({
        error: errorMessage,
        language,
        message: "Execution failed via API",
      });

      res.status(500).json({
        error: errorType,
        message: errorMessage,
      });
    }
  },
);

export default router;
