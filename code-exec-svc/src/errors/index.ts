export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly execution_id: string,
    public readonly error_type: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

export class TimeoutError extends ExecutionError {
  constructor(execution_id: string, timeout: number) {
    super(`Execution timeout after ${timeout}ms`, execution_id, "TimeoutError");
    this.name = "TimeoutError";
  }
}

export class ResourceError extends ExecutionError {
  constructor(execution_id: string, resource: string, limit: number) {
    super(
      `${resource} limit exceeded: ${limit}`,
      execution_id,
      "ResourceError",
    );
    this.name = "ResourceError";
  }
}

export class SecurityError extends ExecutionError {
  constructor(execution_id: string, violation: string) {
    super(`Security violation: ${violation}`, execution_id, "SecurityError");
    this.name = "SecurityError";
  }
}
