/**
 * Mock M365 Auth Server - Middleware
 * 
 * Configures Express middleware for CORS, JSON parsing, and static files.
 */

import path from "node:path";
import cors from "cors";
import type { Express } from "express";
import express from "express";

/**
 * Sets up all Express middleware
 * @param app - Express application instance
 * @param __dirname - Directory name for static file resolution
 */
export function setupMiddleware(app: Express, __dirname: string): void {
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "../public")));
}
