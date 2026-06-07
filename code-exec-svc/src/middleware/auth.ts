import type { NextFunction, Request, Response } from "express";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Check if auth is disabled (development mode)
  if (process.env.AUTH_DISABLED === "true") {
    return next();
  }

  const apiKey = req.headers["x-api-key"] as string;
  const configuredKeys =
    process.env.API_KEYS?.split(",").filter((k) => k.trim()) || [];

  // If no keys configured, allow all requests (but log warning)
  if (configuredKeys.length === 0) {
    console.warn(
      "[AuthMiddleware] No API_KEYS configured. Allowing all requests.",
    );
    return next();
  }

  // Validate API key
  if (!apiKey) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing API key. Include X-API-Key header.",
    });
  }

  // Timing-safe comparison
  const isValid = configuredKeys.some((key) => {
    const keyBuffer = Buffer.from(key);
    const apiKeyBuffer = Buffer.from(apiKey);

    if (keyBuffer.length !== apiKeyBuffer.length) return false;

    let result = 0;
    for (let i = 0; i < keyBuffer.length; i++) {
      result |= keyBuffer[i] ^ apiKeyBuffer[i];
    }
    return result === 0;
  });

  if (!isValid) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key.",
    });
  }

  next();
}
