/**
 * Parses POSTGRES_URL and returns postgres.js connection options.
 *
 * postgres.js does not honour the `?host=` query param as a Unix-socket path
 * when the value starts with `/`. We extract it manually and pass it via the
 * options object so peer-auth over the Unix socket works correctly.
 *
 * Supported URL shapes:
 *   postgresql:///dbname?host=/var/run/postgresql
 *   postgresql://user@/dbname?host=/var/run/postgresql
 *   postgresql://localhost/dbname   (plain TCP, returned as-is)
 */

type PostgresOptions = Parameters<typeof import("postgres")>[0];

export function parsePgUrl(
  rawUrl: string
): Exclude<PostgresOptions, string | undefined> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl as unknown as Exclude<PostgresOptions, string | undefined>;
  }

  const socketHost = url.searchParams.get("host");

  if (socketHost?.startsWith("/")) {
    const database =
      url.pathname.replace(/^\//, "") || url.hostname || undefined;
    const userInfo = url.username || undefined;
    const password = url.password || undefined;

    return {
      host: socketHost,
      ...(database ? { database } : {}),
      ...(userInfo ? { user: userInfo } : {}),
      ...(password ? { password } : {}),
    } as Exclude<PostgresOptions, string | undefined>;
  }

  return rawUrl as unknown as Exclude<PostgresOptions, string | undefined>;
}
