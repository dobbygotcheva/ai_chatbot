import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import { privateKey, publicKey } from "./crypto.js";

const JWT_ALGORITHM = "RS256";
const TOKEN_EXPIRY_SECONDS = 3600;

function generateToken() {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = TOKEN_EXPIRY_SECONDS;

  const accessToken = jwt.sign(
    {
      sub: "dev-mail-uuid",
      email: "dev@mail.com",
      name: "Developer User",
      picture: null,
      exp: now + expiresIn,
    },
    privateKey,
    { algorithm: JWT_ALGORITHM }
  );

  const refreshToken = randomUUID();

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: expiresIn,
  };
}

describe("JWT Token Generation", () => {
  let tokenResponse: ReturnType<typeof generateToken>;

  beforeEach(() => {
    tokenResponse = generateToken();
  });

  describe("Token Structure", () => {
    it("should have access_token as a string", () => {
      expect(tokenResponse.access_token).toBeDefined();
      expect(typeof tokenResponse.access_token).toBe("string");
      expect(tokenResponse.access_token.length).toBeGreaterThan(0);
    });

    it("should have refresh_token in UUID format", () => {
      expect(tokenResponse.refresh_token).toBeDefined();
      expect(typeof tokenResponse.refresh_token).toBe("string");

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(tokenResponse.refresh_token).toMatch(uuidRegex);
    });

    it('should have token_type as "Bearer"', () => {
      expect(tokenResponse.token_type).toBe("Bearer");
    });

    it("should have expires_in as 3600", () => {
      expect(tokenResponse.expires_in).toBe(3600);
    });
  });

  describe("JWT Claims", () => {
    let decodedToken: jwt.JwtPayload;

    beforeEach(() => {
      decodedToken = jwt.decode(tokenResponse.access_token) as jwt.JwtPayload;
    });

    it('should have sub claim as "dev-mail-uuid"', () => {
      expect(decodedToken.sub).toBe("dev-mail-uuid");
    });

    it('should have email claim as "dev@mail.com"', () => {
      expect(decodedToken.email).toBe("dev@mail.com");
    });

    it('should have name claim as "Developer User"', () => {
      expect(decodedToken.name).toBe("Developer User");
    });

    it("should have picture claim as null", () => {
      expect(decodedToken.picture).toBeNull();
    });

    it("should have exp claim in the future (current time + 3600 seconds)", () => {
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + TOKEN_EXPIRY_SECONDS;

      expect(decodedToken.exp).toBeDefined();
      expect(typeof decodedToken.exp).toBe("number");
      // Allow 2 second tolerance for test execution time
      expect(decodedToken.exp).toBeGreaterThanOrEqual(expectedExp - 2);
      expect(decodedToken.exp).toBeLessThanOrEqual(expectedExp + 2);
    });
  });

  describe("Token Verification", () => {
    it("should verify token with public key", () => {
      expect(() => {
        jwt.verify(tokenResponse.access_token, publicKey, {
          algorithms: [JWT_ALGORITHM],
        });
      }).not.toThrow();
    });

    it("should decode to correct payload when verified", () => {
      const verified = jwt.verify(tokenResponse.access_token, publicKey, {
        algorithms: [JWT_ALGORITHM],
      }) as jwt.JwtPayload;

      expect(verified.sub).toBe("dev-mail-uuid");
      expect(verified.email).toBe("dev@mail.com");
      expect(verified.name).toBe("Developer User");
      expect(verified.picture).toBeNull();
      expect(verified.exp).toBeDefined();
    });

    it("should fail verification with wrong key", () => {
      expect(() => {
        jwt.verify(tokenResponse.access_token, "wrong-key", {
          algorithms: [JWT_ALGORITHM],
        });
      }).toThrow();
    });

    it("should use RS256 algorithm", () => {
      const decoded = jwt.decode(tokenResponse.access_token, {
        complete: true,
      }) as jwt.Jwt & { header: jwt.JwtHeader };
      expect(decoded.header.alg).toBe(JWT_ALGORITHM);
    });
  });
});
