import Docker from "dockerode";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContainerManager } from "../src/services/container-manager";

describe("Execution Service Integration", () => {
  const docker = new Docker();
  const containerManager = new ContainerManager();

  beforeAll(async () => {
    // Verify Docker is running
    try {
      await docker.ping();
    } catch (_error) {
      console.warn("⚠️  Docker not available - skipping integration tests");
      console.warn(
        "   To run these tests: ensure Docker daemon is running and user has permissions",
      );
      console.warn(
        "   Commands: sudo usermod -aG docker $USER && newgrp docker",
      );
      throw new Error(
        "Docker is not running. Please start Docker Desktop or docker daemon.",
      );
    }

    // Ensure runtime images exist
    const images = await docker.listImages();
    const requiredImages = [
      "code-exec-python",
      "code-exec-node",
      "code-exec-bash",
    ];

    for (const imageName of requiredImages) {
      const imageExists = images.some((img) =>
        img.RepoTags?.some((tag) => tag.startsWith(imageName)),
      );

      if (!imageExists) {
        throw new Error(
          `Runtime image '${imageName}' not found. Build with: docker build -t ${imageName} -f runtimes/${imageName.replace("code-exec-", "")}/Dockerfile runtimes/${imageName.replace("code-exec-", "")}`,
        );
      }
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup any orphaned containers from failed tests
    try {
      const containers = await docker.listContainers({ all: true });
      for (const container of containers) {
        if (container.Labels?.execution_id) {
          const c = docker.getContainer(container.Id);
          try {
            if (container.State === "running") {
              await c.stop({ t: 5 });
            }
            await c.remove({ force: true });
            console.log(
              `Cleaned up orphaned container: ${container.Id.slice(0, 12)}`,
            );
          } catch (_error) {
            // Ignore cleanup errors
          }
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }, 30000);

  describe("Language Execution", () => {
    it("should execute Python code successfully", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "print('Hello from Python')\nprint(2 + 2)",
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("Hello from Python");
        expect(result.stdout).toContain("4");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);

    it("should execute JavaScript code successfully", async () => {
      const container = await containerManager.createContainer("javascript");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "console.log('Hello from Node.js');\nconsole.log(10 * 5);",
          "javascript",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("Hello from Node.js");
        expect(result.stdout).toContain("50");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);

    it("should execute Bash code successfully", async () => {
      const container = await containerManager.createContainer("bash");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "echo 'Hello from Bash'\nwhoami",
          "bash",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("Hello from Bash");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);
  });

  describe("File Capture", () => {
    it("should capture generated files", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const code = `
with open('/tmp/output.txt', 'w') as f:
    f.write('Generated content from Python')
print('File created successfully')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("File created successfully");
        expect(result.files).toHaveLength(1);
        expect(result.files[0].name).toBe("output.txt");

        // Decode and verify file content
        const content = Buffer.from(result.files[0].content, "base64").toString(
          "utf-8",
        );
        expect(content).toBe("Generated content from Python");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);

    it("should capture multiple generated files", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const code = `
with open('/tmp/file1.txt', 'w') as f:
    f.write('First file')
with open('/tmp/file2.txt', 'w') as f:
    f.write('Second file')
with open('/tmp/data.json', 'w') as f:
    f.write('{"key": "value"}')
print('Multiple files created')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(3);

        const fileNames = result.files.map((f) => f.name).sort();
        expect(fileNames).toEqual(["data.json", "file1.txt", "file2.txt"]);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);
  });

  describe("Image Generation", () => {
    it("should capture matplotlib plots", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const code = `
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

# Create a simple plot
x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(8, 6))
plt.plot(x, y)
plt.title('Sine Wave')
plt.xlabel('x')
plt.ylabel('sin(x)')
plt.grid(True)
plt.savefig('/tmp/sine_plot.png')
print('Plot saved successfully')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("Plot saved successfully");

        // Should have both the plot image and possibly other files
        const images = result.images;
        expect(images.length).toBeGreaterThan(0);

        const plotImage = images.find((img) => img.name === "sine_plot.png");
        expect(plotImage).toBeDefined();
        expect(plotImage?.content_type).toBe("image/png");
        expect(plotImage?.content.length).toBeGreaterThan(0);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 90000);
  });

  describe("Output Handling", () => {
    it("should truncate large output (>1MB)", async () => {
      const container = await containerManager.createContainer("python");

      try {
        // Generate output larger than 1MB
        const code = `
# Generate a string larger than 1MB
large_string = 'A' * 1100000
print(large_string)
print('DONE')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.truncated).toBe(true);
        expect(result.stdout).toContain("[TRUNCATED]");
        // Should still contain the beginning
        expect(result.stdout.length).toBeLessThanOrEqual(1100000);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);

    it("should capture stderr on execution errors", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const code = `
import sys
print('Error message', file=sys.stderr, flush=True)
raise ValueError('Intentional error')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(false);
        expect(result.exit_code).toBeGreaterThan(0);
        expect(result.stderr).toContain("Error message");
        expect(result.stderr).toContain("Traceback");
        expect(result.stderr).toContain("ValueError");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);
  });

  describe("Timeout Enforcement", () => {
    it("should enforce timeout on Python execution", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "import time\nprint('starting sleep')\ntime.sleep(30)\nprint('should not reach here')",
          "python",
          8000,
        );

        expect(result.duration_ms).toBeLessThan(20000);
        expect(result.success).toBe(false);
        // Exit code 137 = 128 + 9 (SIGKILL) from timeout/OOM
        expect(result.exit_code).toBe(137);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 20000);

    it("should enforce timeout on JavaScript execution", async () => {
      const container = await containerManager.createContainer("javascript");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "console.log('starting sleep');\nconst { execSync } = require('child_process');\ntry { execSync('sleep 30'); } catch(e) {}",
          "javascript",
          8000,
        );

        expect(result.duration_ms).toBeLessThan(20000);
        expect(result.success).toBe(false);
        // Exit code 137 = 128 + 9 (SIGKILL) from timeout/OOM
        expect(result.exit_code).toBe(137);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 20000);

    it("should enforce timeout on Bash execution", async () => {
      const container = await containerManager.createContainer("bash");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "echo 'starting sleep'\nsleep 30\necho 'should not reach here'",
          "bash",
          8000,
        );

        expect(result.duration_ms).toBeLessThan(20000);
        expect(result.success).toBe(false);
        // Exit code 137 = 128 + 9 (SIGKILL) from timeout/OOM
        expect(result.exit_code).toBe(137);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 20000);
  });

  describe("Execution ID Uniqueness", () => {
    it.each([
      0, 1, 2, 3, 4,
    ])("should generate unique execution_id (iteration %i)", async (i) => {
      const container = await containerManager.createContainer("python");

      try {
        const result = await containerManager.executeInContainer(
          container,
          `print('Execution ${i}')`,
          "python",
          30000,
        );

        expect(result.execution_id).toBeDefined();
        expect(result.execution_id).toMatch(/^exec_\d+_[a-f0-9]{8}$/);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 90000);

    it("should generate 5 unique execution_ids across multiple executions", async () => {
      const executionIds = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `print('Execution ${i}')`,
            "python",
            30000,
          );

          executionIds.add(result.execution_id);
        } finally {
          await containerManager.destroyContainer(container);
        }
      }

      expect(executionIds.size).toBe(5);
    }, 90000);
  });

  describe("Container Cleanup", () => {
    it("should not leave orphaned containers after multiple executions", async () => {
      const createdContainerIds: string[] = [];

      // Run 3 executions in parallel to stress-test cleanup
      await Promise.all(
        [0, 1, 2].map(async () => {
          const container = await containerManager.createContainer("python");
          const containerId = (await container.inspect()).Id;
          createdContainerIds.push(containerId);
          try {
            const result = await containerManager.executeInContainer(
              container,
              "print('test')",
              "python",
              30000,
            );
            expect(result.success).toBe(true);
            expect(result.exit_code).toBe(0);
          } finally {
            await containerManager.destroyContainer(container);
          }
        }),
      );

      // Small delay to ensure cleanup is complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify all created containers are gone
      const allContainers = await docker.listContainers({ all: true });
      const allContainerIds = allContainers.map((c) => c.Id);

      for (const createdId of createdContainerIds) {
        expect(allContainerIds).not.toContain(createdId);
      }
    }, 90000);

    it("should cleanup container even after execution error", async () => {
      const container = await containerManager.createContainer("python");
      const containerId = (await container.inspect()).Id;

      try {
        // Execute code that will fail
        await containerManager.executeInContainer(
          container,
          "raise RuntimeError('Test error')",
          "python",
          30000,
        );
      } catch (_error) {
        // Expected to fail
      } finally {
        // Ensure cleanup happens
        await containerManager.destroyContainer(container);
      }

      // Verify container is removed
      const containers = await docker.listContainers({ all: true });
      const stillExists = containers.some((c) => c.Id === containerId);
      expect(stillExists).toBe(false);
    }, 60000);
  });

  describe("Edge Cases", () => {
    it("should handle empty code execution", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const result = await containerManager.executeInContainer(
          container,
          "",
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);

    it("should handle code with special characters", async () => {
      const container = await containerManager.createContainer("python");

      try {
        const code = `
print('Special chars: àáâãäåæçèéêë')
print('Emoji: 🐍 🚀 💻')
print('Unicode: \\u0048\\u0065\\u006C\\u006C\\u006F')
`;
        const result = await containerManager.executeInContainer(
          container,
          code,
          "python",
          30000,
        );

        expect(result.success).toBe(true);
        expect(result.exit_code).toBe(0);
        expect(result.stdout).toContain("Special chars");
        expect(result.stdout).toContain("Emoji");
      } finally {
        await containerManager.destroyContainer(container);
      }
    }, 60000);
  });
});
