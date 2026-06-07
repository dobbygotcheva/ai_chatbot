import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";

import {
  MOCK_USER_ADMIN,
  MOCK_USER_DEV,
  TOKEN_EXPIRY_SECONDS,
} from "../constants.js";
import { privateKey, signToken, validateBearerToken } from "../crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authCodes = new Map<string, { userType: string; email?: string; groups?: string[] }>();

function createErrorRedirect(
  redirectUri: string | undefined,
  errorCode: string,
  errorDescription: string
): string {
  const baseUrl = redirectUri || "/";
  return `${baseUrl}?error=${errorCode}&error_description=${encodeURIComponent(errorDescription)}`;
}

export function registerOAuth2Routes(app: Express): void {
  app.get("/login", (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../../public/login.html"));
  });

  app.get("/oauth2/v2.0/authorize", (req: Request, res: Response) => {
    const { client_id, redirect_uri, scope, state, response_type } = req.query;

    if (response_type !== "code") {
      const errorRedirect = createErrorRedirect(
        redirect_uri as string | undefined,
        "unsupported_response_type",
        "Only Authorization Code Flow is supported"
      );
      return res.redirect(errorRedirect);
    }

    if (!client_id) {
      const errorRedirect = createErrorRedirect(
        redirect_uri as string | undefined,
        "invalid_request",
        "Missing client_id"
      );
      return res.redirect(errorRedirect);
    }

    if (!redirect_uri) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing redirect_uri",
      });
    }

    const loginParams = new URLSearchParams({
      redirect_uri: redirect_uri as string,
      client_id: client_id as string,
    });
    if (scope) loginParams.set("scope", scope as string);
    if (state) loginParams.set("state", state as string);

    res.redirect(`/login?${loginParams.toString()}`);
  });

  app.post("/login", (req: Request, res: Response) => {
    const { redirect_uri, state, user_type, email, groups } = req.body;

    if (!redirect_uri) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing redirect_uri",
      });
    }

    const fakeCode = randomUUID();
    const parsedGroups = typeof groups === "string" ? JSON.parse(groups) : groups;
    authCodes.set(fakeCode, { userType: user_type || "admin", email, groups: parsedGroups });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", fakeCode);
    if (state) redirectUrl.searchParams.set("state", state);

    return res.redirect(redirectUrl.toString());
  });

  app.post("/oauth2/v2.0/token", (req: Request, res: Response) => {
    const { grant_type, code, redirect_uri } = req.body;

    if (grant_type !== "authorization_code") {
      res.status(400).json({
        error: "unsupported_grant_type",
        error_description: "Only authorization_code grant type is supported",
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "Missing authorization code",
      });
      return;
    }

    if (!redirect_uri) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "Missing redirect_uri",
      });
      return;
    }

    const authData = authCodes.get(code);
    authCodes.delete(code);

    const userType = authData?.userType || "admin";
    const customEmail = authData?.email;
    const customGroups = authData?.groups;

    const isCustomUser = userType === "custom" && customEmail && customGroups;

    const selectedUser = isCustomUser
      ? {
          sub: `custom-${randomUUID()}`,
          email: customEmail,
          name: customEmail.split("@")[0],
          picture: null,
        }
      : userType === "admin"
        ? MOCK_USER_ADMIN
        : MOCK_USER_DEV;

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = TOKEN_EXPIRY_SECONDS;

    const accessToken = signToken({
      ...selectedUser,
      exp: now + expiresIn,
    });

    const idToken = jwt.sign(
      {
        ...selectedUser,
        aud: "mock-client-id",
        iss: "https://login.microsoftonline.com/common/v2.0",
        iat: now,
        exp: now + expiresIn,
      },
      privateKey,
      { algorithm: "RS256" }
    );

    const refreshToken = randomUUID();

    res.json({
      access_token: accessToken,
      id_token: idToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  });

  app.get("/oauth2/v2.0/userinfo", (req: Request, res: Response) => {
    const decoded = validateBearerToken(req, res);
    if (!decoded) {
      return;
    }

    res.json({
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    });
  });
}
