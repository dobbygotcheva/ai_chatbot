import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { setupMiddleware } from "./middleware.js";
import { registerOAuth2Routes } from "./routes/oauth2.js";
import { registerGraphRoutes } from "./routes/graph.js";
import { registerDiscoveryRoutes } from "./routes/discovery.js";
import { registerHealthRoutes } from "./routes/health.js";
import { publicKey } from "./crypto.js";

const TEST_CLIENT_ID = "6808e6cd-2f6d-4865-a5d7-38c9470585bd";
const TEST_CLIENT_SECRET = "test-secret";
const TEST_REDIRECT_URI = "http://localhost:3000/api/auth/callback/azure-ad";

let app: express.Express;
let testAuthCode: string;

beforeAll(() => {
  app = express();
  setupMiddleware(app, "/public");
  registerHealthRoutes(app);
  registerDiscoveryRoutes(app);
  registerOAuth2Routes(app);
  registerGraphRoutes(app);
});

describe("Mock M365 Auth Server - Integration Tests", () => {
  describe("Health Endpoint", () => {
    it("should return healthy status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("OIDC Discovery", () => {
    it("should return valid OIDC configuration", async () => {
      const response = await request(app).get(
        "/.well-known/openid-configuration"
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        issuer: "http://localhost:8080",
        authorization_endpoint: "http://localhost:8080/oauth2/v2.0/authorize",
        token_endpoint: "http://localhost:8080/oauth2/v2.0/token",
        userinfo_endpoint: "http://localhost:8080/oauth2/v2.0/userinfo",
        jwks_uri: "http://localhost:8080/.well-known/jwks.json",
        response_types_supported: expect.arrayContaining([
          "code",
          "token",
          "id_token",
        ]),
        id_token_signing_alg_values_supported: ["RS256"],
        scopes_supported: expect.arrayContaining([
          "openid",
          "profile",
          "email",
          "User.Read",
          "GroupMember.Read.All",
        ]),
      });
    });

    it("should return valid JWKS", async () => {
      const response = await request(app).get("/.well-known/jwks.json");

      expect(response.status).toBe(200);
      expect(response.body.keys).toBeInstanceOf(Array);
      expect(response.body.keys.length).toBeGreaterThan(0);
      expect(response.body.keys[0]).toMatchObject({
        kid: "mock-key-1",
        use: "sig",
        alg: "RS256",
        kty: "RSA",
      });
    });
  });

  describe("OAuth2 Authorization Endpoint", () => {
    it("should reject non-code response_type", async () => {
      const response = await request(app)
        .get("/oauth2/v2.0/authorize")
        .query({
          client_id: TEST_CLIENT_ID,
          redirect_uri: TEST_REDIRECT_URI,
          response_type: "token",
          state: "test-state",
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=unsupported_response_type");
    });

    it("should reject missing client_id", async () => {
      const response = await request(app)
        .get("/oauth2/v2.0/authorize")
        .query({
          redirect_uri: TEST_REDIRECT_URI,
          response_type: "code",
          state: "test-state",
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("error=invalid_request");
    });

    it("should redirect to login page with state parameter", async () => {
      const response = await request(app)
        .get("/oauth2/v2.0/authorize")
        .query({
          client_id: TEST_CLIENT_ID,
          redirect_uri: TEST_REDIRECT_URI,
          response_type: "code",
          scope: "openid profile email",
          state: "test-state-123",
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/login");
      expect(response.headers.location).toContain("state=test-state-123");
      expect(response.headers.location).toContain(
        `redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}`
      );
      expect(response.headers.location).toContain(
        `client_id=${encodeURIComponent(TEST_CLIENT_ID)}`
      );
    });

    it("should handle missing state parameter gracefully", async () => {
      const response = await request(app)
        .get("/oauth2/v2.0/authorize")
        .query({
          client_id: TEST_CLIENT_ID,
          redirect_uri: TEST_REDIRECT_URI,
          response_type: "code",
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("/login");
      expect(response.headers.location).not.toContain("state=");
    });
  });

  describe("OAuth2 Token Endpoint", () => {
    beforeEach(() => {
      testAuthCode = "test-auth-code-" + Date.now();
    });

    it("should reject unsupported grant_type", async () => {
      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .send({
          grant_type: "client_credentials",
          code: testAuthCode,
          redirect_uri: TEST_REDIRECT_URI,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("unsupported_grant_type");
    });

    it("should reject missing authorization code", async () => {
      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          redirect_uri: TEST_REDIRECT_URI,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("invalid_request");
    });

    it("should reject missing redirect_uri", async () => {
      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          code: testAuthCode,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("invalid_request");
    });

    it("should return valid token response with client_id from body", async () => {
      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          code: testAuthCode,
          redirect_uri: TEST_REDIRECT_URI,
          client_id: TEST_CLIENT_ID,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        access_token: expect.any(String),
        id_token: expect.any(String),
        refresh_token: expect.any(String),
        token_type: "Bearer",
        expires_in: 3600,
      });
    });

    it("should extract client_id from Basic Auth header", async () => {
      const credentials = Buffer.from(
        `${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`
      ).toString("base64");

      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .set("Authorization", `Basic ${credentials}`)
        .send({
          grant_type: "authorization_code",
          code: testAuthCode,
          redirect_uri: TEST_REDIRECT_URI,
        });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.id_token).toBeDefined();
    });

    it("should use client_id as audience claim in id_token", async () => {
      const credentials = Buffer.from(
        `${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`
      ).toString("base64");

      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .set("Authorization", `Basic ${credentials}`)
        .send({
          grant_type: "authorization_code",
          code: testAuthCode,
          redirect_uri: TEST_REDIRECT_URI,
        });

      expect(response.status).toBe(200);

      const idToken = response.body.id_token;
      const decoded = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64").toString("utf-8")
      );

      expect(decoded.aud).toBe(TEST_CLIENT_ID);
      expect(decoded.sub).toBe("dev-mail-uuid");
      expect(decoded.email).toBe("dev@mail.com");
      expect(decoded.iss).toBe("https://login.microsoftonline.com/common/v2.0");
    });

    it("should use client_id from body when Basic Auth not provided", async () => {
      const response = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          code: testAuthCode,
          redirect_uri: TEST_REDIRECT_URI,
          client_id: "custom-client-id",
        });

      expect(response.status).toBe(200);

      const idToken = response.body.id_token;
      const decoded = JSON.parse(
        Buffer.from(idToken.split(".")[1], "base64").toString("utf-8")
      );

      expect(decoded.aud).toBe("custom-client-id");
    });
  });

  describe("Graph API Endpoint", () => {
    let validAccessToken: string;

    beforeEach(async () => {
      const credentials = Buffer.from(
        `${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`
      ).toString("base64");

      const tokenResponse = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .set("Authorization", `Basic ${credentials}`)
        .send({
          grant_type: "authorization_code",
          code: "test-code",
          redirect_uri: TEST_REDIRECT_URI,
        });

      validAccessToken = tokenResponse.body.access_token;
    });

    it("should reject requests without Bearer token", async () => {
      const response = await request(app).get(
        "/me/memberOf/microsoft.graph.group"
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("unauthorized");
    });

    it("should reject requests with invalid token", async () => {
      const response = await request(app)
        .get("/me/memberOf/microsoft.graph.group")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.error_description).toBe("Invalid token");
    });

    it("should return group memberships with valid token", async () => {
      const response = await request(app)
        .get("/me/memberOf/microsoft.graph.group")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        value: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            displayName: expect.any(String),
          }),
        ]),
      });
    });
  });

  describe("Complete OAuth2 Flow", () => {
    it("should complete full authorization code flow", async () => {
      const state = "test-state-" + Date.now();

      const authResponse = await request(app)
        .get("/oauth2/v2.0/authorize")
        .query({
          client_id: TEST_CLIENT_ID,
          redirect_uri: TEST_REDIRECT_URI,
          response_type: "code",
          state,
        });

      expect(authResponse.status).toBe(302);
      expect(authResponse.headers.location).toContain("/login");

      const tokenResponse = await request(app)
        .post("/oauth2/v2.0/token")
        .type("form")
        .set(
          "Authorization",
          `Basic ${Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString("base64")}`
        )
        .send({
          grant_type: "authorization_code",
          code: "simulated-code",
          redirect_uri: TEST_REDIRECT_URI,
        });

      expect(tokenResponse.status).toBe(200);
      expect(tokenResponse.body.access_token).toBeDefined();
      expect(tokenResponse.body.id_token).toBeDefined();

      const idTokenDecoded = JSON.parse(
        Buffer.from(tokenResponse.body.id_token.split(".")[1], "base64").toString(
          "utf-8"
        )
      );
      expect(idTokenDecoded.aud).toBe(TEST_CLIENT_ID);
      expect(idTokenDecoded.sub).toBe("dev-mail-uuid");
    });
  });
});
