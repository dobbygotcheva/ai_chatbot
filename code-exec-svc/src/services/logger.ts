interface LogEntry {
  timestamp?: string;
  level: "info" | "warn" | "error";
  execution_id?: string;
  language?: string;
  duration_ms?: number;
  success?: boolean;
  error?: string;
  message: string;
}

export class Logger {
  info(entry: Omit<LogEntry, "level">) {
    console.log(
      JSON.stringify({
        ...entry,
        level: "info",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  error(entry: Omit<LogEntry, "level">) {
    console.error(
      JSON.stringify({
        ...entry,
        level: "error",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  warn(entry: Omit<LogEntry, "level">) {
    console.warn(
      JSON.stringify({
        ...entry,
        level: "warn",
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

export const logger = new Logger();
