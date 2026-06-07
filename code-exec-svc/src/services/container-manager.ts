import { randomUUID } from "node:crypto";
import Docker, { type Container, type ContainerCreateOptions } from "dockerode";
import {
  ExecutionError,
  ResourceError,
  SecurityError,
  TimeoutError,
} from "../errors";
import { metrics } from "../metrics";
import { logger } from "./logger";
import { type FormattedOutput, formatOutput } from "./output-formatter";

export interface ExecutionResult {
  execution_id: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  error?: string;
}

interface ContainerLabels {
  [label: string]: string;
}

const RUNTIME_IMAGES: Record<string, string> = {
  python: "code-exec-python",
  javascript: "code-exec-node",
  bash: "code-exec-bash",
};

export class ContainerManager {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  private generateExecutionId(): string {
    const timestamp = Date.now();
    const uuid = randomUUID().slice(0, 8);
    return `exec_${timestamp}_${uuid}`;
  }

  async createContainer(language: string): Promise<Container> {
    const executionId = this.generateExecutionId();
    const image = RUNTIME_IMAGES[language.toLowerCase()];

    if (!image) {
      throw new Error(
        `Unsupported language: ${language}. Supported: ${Object.keys(RUNTIME_IMAGES).join(", ")}`,
      );
    }

    const labels: ContainerLabels = {
      execution_id: executionId,
      language: language.toLowerCase(),
      created_at: new Date().toISOString(),
    };

    const createOptions: ContainerCreateOptions = {
      Image: image,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      OpenStdin: false,
      StdinOnce: false,
      Labels: labels,
      WorkingDir: "/tmp",
      // Security: Network disabled, read-only root filesystem
      NetworkDisabled: true,
      HostConfig: {
        // Drop all Linux capabilities for security
        CapDrop: ["ALL"],
        // Read-only root filesystem
        ReadonlyRootfs: true,
        // Tmpfs for /tmp (writable, noexec for security, 100MB limit)
        Tmpfs: {
          "/tmp": "rw,noexec,nosuid,size=100m",
        },
        // Resource limits
        CpuQuota: 100000, // 1 CPU core (100000 microseconds)
        Memory: 536870912, // 512MB
        MemorySwap: 536870912, // Same as memory (no swap)
        PidsLimit: 50, // Max 50 processes
        // Security: no-new-privileges prevents setuid attacks
        SecurityOpt: ["no-new-privileges:true"],
      },
    };

    try {
      const container = await this.docker.createContainer(createOptions);

      // Start the container so it's running when we exec into it
      await container.start();

      console.log(
        `[ContainerManager] Created and started container ${container.id.slice(0, 12)} for execution ${executionId} (language: ${language})`,
      );

      return container;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Docker error";
      console.error(
        `[ContainerManager] Failed to create container: ${errorMessage}`,
      );
      throw new Error(`Failed to create container: ${errorMessage}`);
    }
  }

  async executeInContainer(
    container: Container,
    code: string,
    language: string,
    timeout: number = 30000,
  ): Promise<FormattedOutput> {
    const containerInfo = await container.inspect();
    const executionId = containerInfo.Config.Labels?.execution_id || "unknown";

    const timeoutPromise = new Promise<FormattedOutput>((resolve) => {
      setTimeout(async () => {
        await this.destroyContainer(container);
        resolve({
          execution_id: executionId,
          stdout: "",
          stderr: "",
          exit_code: -1,
          success: false,
          duration_ms: timeout,
          files: [],
          images: [],
          truncated: false,
        } as FormattedOutput);
      }, timeout);
    });

    const executionPromise = (async (): Promise<FormattedOutput> => {
      const startTime = Date.now();

      try {
        const { interpreter, fileExt } =
          this.getInterpreterForLanguage(language);

        // Base64 encode the code
        const base64Code = Buffer.from(code).toString("base64");

        // Write file and execute in /tmp (tmpfs - guaranteed writable)
        const fileName = `${executionId}.${fileExt}`;
        const filePath = `/tmp/${fileName}`;

        const writeAndExecCmd = [
          "sh",
          "-c",
          `echo '${base64Code}' | base64 -d > '${filePath}' && chmod +x '${filePath}' && ${interpreter} '${filePath}'`,
        ];

        console.log(`[executeInContainer] Executing in /tmp`);

        const exec = await container.exec({
          AttachStdout: true,
          AttachStderr: true,
          Cmd: writeAndExecCmd,
        });

        const stream = await exec.start({
          hijack: false,
          stdin: false,
          Tty: false,
        });

        const { stdout, stderr } = await this.collectOutput(stream);
        const exitCode = await this.getExitCode(exec);

        const duration = Date.now() - startTime;
        const success = exitCode === 0;

        logger.info({
          execution_id: executionId,
          language,
          duration_ms: duration,
          success,
          message: "Execution completed",
        });
        metrics.recordExecution(language, duration, success);

        // Format output with files and images
        const formattedOutput = await formatOutput(
          container,
          executionId,
          stdout,
          stderr,
          exitCode,
          duration,
        );

        return formattedOutput;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown execution error";
        const duration = Date.now() - startTime;

        logger.error({
          execution_id: executionId,
          language,
          duration_ms: duration,
          success: false,
          error: errorMessage,
          message: "Execution failed",
        });
        metrics.recordExecution(language, duration, false);

        // Throw appropriate error types based on error characteristics
        if (errorMessage.includes("timeout")) {
          throw new TimeoutError(executionId, timeout);
        }

        if (
          errorMessage.includes("memory") ||
          errorMessage.includes("resource")
        ) {
          throw new ResourceError(executionId, "memory", 512);
        }

        if (
          errorMessage.includes("security") ||
          errorMessage.includes("violation")
        ) {
          throw new SecurityError(executionId, errorMessage);
        }

        // Default to generic ExecutionError
        throw new ExecutionError(errorMessage, executionId, "ExecutionError");
      }
    })();

    return Promise.race([timeoutPromise, executionPromise]);
  }

  async destroyContainer(container: Container): Promise<void> {
    try {
      const containerInfo = await container.inspect();
      const executionId =
        containerInfo.Config.Labels?.execution_id || "unknown";
      const containerId = container.id.slice(0, 12);

      if (containerInfo.State.Running) {
        await container.stop({ t: 5 });
        console.log(
          `[ContainerManager] Stopped container ${containerId} (execution: ${executionId})`,
        );
      }

      await container.remove({ force: true });

      console.log(
        `[ContainerManager] Destroyed container ${containerId} (execution: ${executionId})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[ContainerManager] Failed to destroy container: ${errorMessage}`,
      );
    }
  }

  private getInterpreterForLanguage(language: string): {
    interpreter: string;
    fileExt: string;
  } {
    switch (language.toLowerCase()) {
      case "python":
        return { interpreter: "python3 -u", fileExt: "py" };
      case "javascript":
        return { interpreter: "node", fileExt: "js" };
      case "bash":
        return { interpreter: "bash", fileExt: "sh" };
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private async collectOutput(
    stream: NodeJS.ReadableStream,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let buffer = Buffer.alloc(0);

      stream.on("data", (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 8) {
          const streamType = buffer[0];
          const size = buffer.readUInt32BE(4);
          const frameSize = 8 + size;

          if (buffer.length >= frameSize) {
            const data = buffer.slice(8, frameSize).toString("utf8");
            if (streamType === 1) {
              stdout += data;
            } else if (streamType === 2) {
              stderr += data;
            }
            buffer = buffer.slice(frameSize);
          } else {
            break;
          }
        }
      });

      stream.on("end", () => {
        resolve({ stdout, stderr });
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });
  }

  private async getExitCode(exec: Docker.Exec): Promise<number> {
    try {
      const inspectResult = await exec.inspect();
      return inspectResult.ExitCode ?? -1;
    } catch (error) {
      console.error("[ContainerManager] Failed to get exit code:", error);
      return -1;
    }
  }
}

export default ContainerManager;
