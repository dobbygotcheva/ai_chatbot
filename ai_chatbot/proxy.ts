import { type NextRequest, NextResponse } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { NEXT_AUTH_SESSION_COOKIE_NAME } from "./lib/constants";
import { config as appConfig } from "./shared/config";

const guestRegex = /^guest-\d+$/;

/**
 * clearStaleAuthChunks
 *
 * NextAuth.js splits large JWTs into numbered cookie chunks:
 *   authjs.session-token.0, authjs.session-token.1, …
 * When the JWT shrinks (e.g. after we stopped embedding OAuth tokens), the
 * server writes fewer chunks on the next sign-in but never deletes the old
 * extras. They accumulate and the Cookie header eventually exceeds Node.js's
 * limit, causing HTTP 431 "Request Header Fields Too Large".
 *
 * This function expires any leftover numbered chunks — but ONLY when the
 * plain (un-numbered) token also exists. If the plain token is absent, the
 * session IS currently stored as a numbered chunk (.0), and deleting it would
 * silently log the user out and trigger a redirect loop.
 */
function clearStaleAuthChunks(response: NextResponse, request: NextRequest) {
  const cookies = request.cookies.getAll();

  const hasPlainToken = cookies.some(
    (c) =>
      c.name === NEXT_AUTH_SESSION_COOKIE_NAME ||
      c.name === `__Secure-${NEXT_AUTH_SESSION_COOKIE_NAME}`
  );

  // Active session is still stored as numbered chunks — leave them alone.
  if (!hasPlainToken) {
    return;
  }

  const chunkPattern = /^((?:__Secure-)?next-auth\.session-token)\.\d+$/;
  for (const cookie of cookies) {
    if (chunkPattern.test(cookie.name)) {
      response.cookies.set({
        name: cookie.name,
        value: "",
        maxAge: 0,
        path: "/",
      });
    }
  }
}

/**
 * Paths that must be reachable WITHOUT an authenticated session.
 * Any path not in this set that lacks a valid JWT is redirected to /login.
 * Keep this list minimal — add only true public routes here.
 */
const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    // Health-check endpoint — no auth needed.
    if (pathname.startsWith("/ping")) {
      return new Response("pong", { status: 200 });
    }

    // Never intercept NextAuth API routes or Next.js internals.
    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/static/")
    ) {
      return NextResponse.next();
    }

    // --- Public auth pages ---
    if (PUBLIC_PATHS.has(pathname)) {
      let token: JWT | null = null;
      try {
        token = await getToken({
          req: request,
          secret: appConfig.auth.secret,
          secureCookie: appConfig.auth.url?.startsWith("https://") ?? false,
          cookieName: NEXT_AUTH_SESSION_COOKIE_NAME,
        });
      } catch {
        return NextResponse.next();
      }
      const isGuest = guestRegex.test(token?.email ?? "");
      if (token && !isGuest) {
        const response = NextResponse.redirect(new URL("/", request.url));
        clearStaleAuthChunks(response, request);
        return response;
      }
      return NextResponse.next();
    }

    // --- Protected routes ---
    let token: JWT | null = null;
    let getTokenError: unknown = null;
    try {
      token = await getToken({
        req: request,
        secret: appConfig.auth.secret,
        secureCookie: appConfig.auth.url?.startsWith("https://") ?? false,
        cookieName: NEXT_AUTH_SESSION_COOKIE_NAME,
      });
    } catch (error) {
      getTokenError = error;
    }

    if (getTokenError) {
      console.error("[proxy] getToken error:", getTokenError);
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (!token) {
      const callbackUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
      );
    }

    const response = NextResponse.next();
    clearStaleAuthChunks(response, request);
    return response;
  } catch {
    // Last-resort fallback — never return an empty response.
    return NextResponse.next();
  }
}

export const config = {
  /**
   * Middleware matcher — controls which URLs this function runs for.
   *
   * The catch-all negative-lookahead pattern at the bottom excludes:
   *   _next/static   — compiled JS/CSS bundles (Next.js internal)
   *   _next/image    — image optimisation endpoint (Next.js internal)
   *   favicon.ico, sitemap.xml, robots.txt — standard public metadata
   *   images/        — files under /public/images/ (background GIF, photos…)
   *
   * ⚠️  IMPORTANT: `images/` MUST stay in the exclusion list.
   * Without it, unauthenticated requests to e.g. /images/road-animation.gif
   * receive a 307 redirect to /login instead of the file — so every CSS
   * background-image on the auth pages returns a redirect and the browser
   * renders nothing but the fallback background-color.
   */
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images/|scenario_icons/).*)",
  ],
};
