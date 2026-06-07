import rateLimit from "express-rate-limit";

export const executeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    error: "Too Many Requests",
    message: "Rate limit exceeded. Maximum 10 requests per minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use default keyGenerator which is IPv6-safe
});
