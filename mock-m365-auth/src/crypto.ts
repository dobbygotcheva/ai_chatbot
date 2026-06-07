/**
 * Mock M365 Auth Server - Crypto Utilities
 *
 * Handles RSA key generation, JWK export, and token operations.
 */

import { createPublicKey, generateKeyPairSync } from "node:crypto";
import type { Request, Response } from "express";
import { exportJWK } from "jose";
import jwt, { type JwtPayload } from "jsonwebtoken";

/**
 * RSA key pair for RS256 signing (development only)
 * Generated once on module load
 */
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

/**
 * Public key in JWK format for JWKS endpoint
 */
export const publicJwk = await exportJWK(createPublicKey(publicKey));

/**
 * Public key for token verification (exported for tests)
 */
/**
 * Private key for signing tokens (exported for use in oauth2 routes)
 */
export { privateKey, publicKey };

/**
 * Signs a JWT token using RS256 algorithm
 * @param payload - The token payload
 * @returns Signed JWT token
 */
export function signToken(payload: object): string {
  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}

/**
 * Validates Bearer token from Authorization header
 * @param req - Express request object
 * @param res - Express response object
 * @returns Decoded JWT payload if valid, null otherwise
 */
export function validateBearerToken(
  req: Request,
  res: Response
): JwtPayload | null {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Missing or invalid Authorization header",
    });
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as JwtPayload;
    return decoded;
  } catch {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Invalid token",
    });
    return null;
  }
}
