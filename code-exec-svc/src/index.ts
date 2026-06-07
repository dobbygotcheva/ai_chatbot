import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { metrics } from "./metrics";
import executeRouter from "./routes/execute";
import healthRouter from "./routes/health";

const app: Application = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

app.use(executeRouter);
app.use(healthRouter);

app.get("/metrics", (_req: Request, res: Response) => {
  const m = metrics.getMetrics();
  res.json({
    ...m,
    avg_duration_ms: metrics.getAvgDuration(),
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Not found",
  });
});

app.listen(PORT, () => {
  console.log(`Code execution service running on port ${PORT}`);
});

export default app;
