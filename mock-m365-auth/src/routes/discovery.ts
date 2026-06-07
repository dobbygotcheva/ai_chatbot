/**
 * Mock M365 Auth Server - Discovery Routes
 *
 * OpenID Connect Discovery endpoints (JWKS).
 */

import type { Express, Request, Response } from "express";

import { publicJwk } from "../crypto.js";

/**
 * Registers OpenID Connect Discovery routes
 * @param app - Express application instance
 */
export function registerDiscoveryRoutes(app: Express): void {
  app.get("/.well-known/openid-configuration", (_req: Request, res: Response) => {
    res.json({
      issuer: "http://localhost:8080",
      authorization_endpoint: "http://localhost:8080/oauth2/v2.0/authorize",
      token_endpoint: "http://localhost:8080/oauth2/v2.0/token",
      userinfo_endpoint: "http://localhost:8080/oauth2/v2.0/userinfo",
      jwks_uri: "http://localhost:8080/.well-known/jwks.json",
      response_types_supported: ["code", "token", "id_token"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email", "User.Read", "GroupMember.Read.All"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      claims_supported: ["sub", "email", "name", "picture"],
    });
  });

  // JWKS endpoint - provides public key for token verification
  app.get("/.well-known/jwks.json", (_req: Request, res: Response) => {
    res.json({
      keys: [
        {
          ...publicJwk,
          kid: "mock-key-1",
          use: "sig",
          alg: "RS256",
        },
      ],
    });
  });
}
