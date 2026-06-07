import Docker from "dockerode";
import type { Request, Response } from "express";
import { Router } from "express";

const router: ReturnType<typeof Router> = Router();
const docker = new Docker();
const startTime = Date.now();

router.get("/health", async (_req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const queueSize = 0;

  try {
    await docker.ping();

    res.json({
      status: "healthy",
      uptime,
      queue_size: queueSize,
      docker_connected: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    res.status(503).json({
      status: "unhealthy",
      uptime,
      queue_size: queueSize,
      docker_connected: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
