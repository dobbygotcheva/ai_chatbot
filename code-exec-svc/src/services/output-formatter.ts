import type { Container } from "dockerode";

export interface FormattedOutput {
  execution_id: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  success: boolean;
  duration_ms: number;
  files: Array<{
    name: string;
    content: string; // base64
    size: number;
  }>;
  images: Array<{
    name: string;
    content_type: string;
    content: string; // base64
  }>;
  truncated: boolean;
}

const MAX_OUTPUT_SIZE = 1048576; // 1MB
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".gif"];

export async function formatOutput(
  container: Container,
  executionId: string,
  stdout: string,
  stderr: string,
  exitCode: number,
  durationMs: number,
): Promise<FormattedOutput> {
  const files: FormattedOutput["files"] = [];
  const images: FormattedOutput["images"] = [];
  let truncated = false;

  // Truncate stdout/stderr if needed
  let formattedStdout = stdout;
  let formattedStderr = stderr;

  if (stdout.length > MAX_OUTPUT_SIZE) {
    formattedStdout =
      stdout.slice(0, MAX_OUTPUT_SIZE) +
      "\n[TRUNCATED] Output exceeded 1MB limit";
    truncated = true;
  }
  if (stderr.length > MAX_OUTPUT_SIZE) {
    formattedStderr =
      stderr.slice(0, MAX_OUTPUT_SIZE) +
      "\n[TRUNCATED] Output exceeded 1MB limit";
    truncated = true;
  }

  // List files in /tmp
  try {
    const exec = await container.exec({
      Cmd: ["find", "/tmp", "-type", "f"],
      AttachStdout: true,
    });

    const stream = await exec.start({ hijack: true });
    const fileList = await new Promise<string>((resolve) => {
      let data = "";
      stream.on("data", (chunk: Buffer) => {
        // Docker exec stream format: [stream_type(1 byte), padding(3 bytes), size(4 bytes BE), data]
        if (chunk.length >= 8) {
          const size = chunk.readUInt32BE(4);
          data += chunk.slice(8, 8 + size).toString("utf8");
        } else {
          data += chunk.toString();
        }
      });
      stream.on("end", () => resolve(data));
    });

    const filePaths = fileList
      .trim()
      .split("\n")
      .filter((f) => {
        if (f.length === 0) return false;
        const fileName = f.split("/").pop() || "";
        // Exclude execution script files (exec_timestamp_uuid.py/js/sh)
        if (/^exec_\d+_[a-f0-9]{8}\.(py|js|sh)$/.test(fileName)) return false;
        // Exclude matplotlib font cache files
        if (/^fontlist-v\d+\.json$/.test(fileName)) return false;
        return true;
      });

    console.log(
      `[formatOutput] Found ${filePaths.length} files in /tmp:`,
      filePaths,
    );

    for (const filePath of filePaths) {
      const fileName = filePath.split("/").pop() || "unknown";
      const isImage = IMAGE_EXTENSIONS.some((ext) =>
        fileName.toLowerCase().endsWith(ext),
      );

      // Read file content - use cat and encode on our side to avoid base64 line wrapping
      const readExec = await container.exec({
        Cmd: ["cat", filePath],
        AttachStdout: true,
      });

      const readStream = await readExec.start({ hijack: true });
      const fileBuffer = await new Promise<Buffer>((resolve) => {
        const chunks: Buffer[] = [];
        let buffer = Buffer.alloc(0);

        readStream.on("data", (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk]);

          // Parse Docker exec stream format: [stream_type(1 byte), padding(3 bytes), size(4 bytes BE), data]
          while (buffer.length >= 8) {
            const size = buffer.readUInt32BE(4);
            const frameSize = 8 + size;

            if (buffer.length >= frameSize) {
              const data = buffer.slice(8, frameSize);
              chunks.push(data);
              buffer = buffer.slice(frameSize);
            } else {
              break;
            }
          }
        });

        readStream.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      });

      const base64Content = fileBuffer.toString("base64");

      // Get file size
      const sizeExec = await container.exec({
        Cmd: ["stat", "-c", "%s", filePath],
        AttachStdout: true,
      });

      const sizeStream = await sizeExec.start({ hijack: true });
      const size = parseInt(
        await new Promise<string>((resolve) => {
          let buffer = Buffer.alloc(0);
          let sizeData = "";

          sizeStream.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);

            // Parse Docker exec stream format and extract data
            while (buffer.length >= 8) {
              const frameSize = 8 + buffer.readUInt32BE(4);
              if (buffer.length >= frameSize) {
                sizeData += buffer.slice(8, frameSize).toString();
                buffer = buffer.slice(frameSize);
              } else {
                break;
              }
            }
          });
          sizeStream.on("end", () => resolve(sizeData.trim()));
        }),
        10,
      );

      if (isImage) {
        const contentType = `image/${fileName.endsWith(".svg") ? "svg+xml" : fileName.split(".").pop()}`;
        images.push({
          name: fileName,
          content_type: contentType,
          content: base64Content,
        });
      } else {
        files.push({ name: fileName, content: base64Content, size });
      }
    }
  } catch (_error) {
    // No files or error reading - continue with empty arrays
  }

  return {
    execution_id: executionId,
    stdout: formattedStdout,
    stderr: formattedStderr,
    exit_code: exitCode,
    success: exitCode === 0,
    duration_ms: durationMs,
    files,
    images,
    truncated,
  };
}
