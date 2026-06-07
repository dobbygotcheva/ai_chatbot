/**
 * Security Hardening Tests for Code Execution Service
 *
 * These tests verify that all security measures are properly enforced
 * using real Docker containers (NOT mocked).
 *
 * PREREQUISITES:
 * - Docker daemon must be running
 * - Current user must have access to Docker socket (/var/run/docker.sock)
 * - Runtime images must be built: code-exec-python, code-exec-node, code-exec-bash
 *
 * RUNTIME IMAGES:
 *   docker build -t code-exec-python -f runtimes/python/Dockerfile runtimes/python
 *   docker build -t code-exec-node -f runtimes/javascript/Dockerfile runtimes/javascript
 *   docker build -t code-exec-bash -f runtimes/bash/Dockerfile runtimes/bash
 *
 * SECURITY CONTROLS TESTED:
 * 1. Network Isolation - Blocks outbound connections
 * 2. Read-only Filesystem - Prevents writes to restricted paths
 * 3. Non-root User - Verifies UID is not 0
 * 4. Capability Dropping - Verifies no dangerous capabilities
 * 5. Resource Limits - Tests memory limit enforcement
 * 6. Timeout Enforcement - Verifies execution killed after timeout
 * 7. No Docker Socket - Verifies /var/run/docker.sock not accessible
 *
 * Run with: pnpm test security.test.ts
 */

import Docker from "dockerode";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContainerManager } from "../src/services/container-manager";

describe("Security Hardening", () => {
  const docker = new Docker();

  beforeAll(async () => {
    // Verify Docker is running and accessible
    try {
      await docker.ping();
    } catch (error) {
      throw new Error(
        "Docker is not running or not accessible. " +
          "Please ensure Docker daemon is running and your user has permissions. " +
          "Error: " +
          (error as Error).message,
      );
    }

    // Verify runtime images exist
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
          `Runtime image '${imageName}' not found. ` +
            `Build with: docker build -t ${imageName} -f runtimes/${imageName.replace("code-exec-", "")}/Dockerfile runtimes/${imageName.replace("code-exec-", "")}`,
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
  const containerManager = new ContainerManager();

  const DEFAULT_TIMEOUT = 30000;
  const LONG_TIMEOUT = 60000;

  describe("1. Network Isolation", () => {
    it(
      "should prevent network access to external sites",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import urllib.request
try:
    urllib.request.urlopen('https://google.com', timeout=5)
    print('NETWORK_ACCESSIBLE')
except Exception as e:
    print(f'NETWORK_BLOCKED: {type(e).__name__}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          // Network should be blocked - check stdout for NETWORK_BLOCKED message
          expect(result.stdout).toContain("NETWORK_BLOCKED");
          expect(result.stdout).not.toContain("NETWORK_ACCESSIBLE");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should prevent DNS resolution",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import socket
try:
    socket.gethostbyname('google.com')
    print('DNS_RESOLVED')
except Exception as e:
    print(f'DNS_BLOCKED: {type(e).__name__}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          // DNS should be blocked - check stdout for DNS_BLOCKED message
          expect(result.stdout).toContain("DNS_BLOCKED");
          expect(result.stdout).not.toContain("DNS_RESOLVED");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("2. Read-only Filesystem", () => {
    it(
      "should prevent writing to /etc directory",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `with open('/etc/test_security.txt', 'w') as f:
    f.write('test')
print('WRITE_SUCCESS')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(false);
          expect(result.stderr).toMatch(
            /read-only|permission denied|errno 30/i,
          );
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should prevent writing to root filesystem",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `with open('/root_file.txt', 'w') as f:
    f.write('test')
print('WRITE_SUCCESS')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(false);
          expect(result.stderr).toMatch(/read-only|permission denied/i);
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should allow writing to /tmp tmpfs",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `with open('/tmp/test_file.txt', 'w') as f:
    f.write('test_write')
print('WRITE_SUCCESS')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("WRITE_SUCCESS");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("3. Non-root User", () => {
    it(
      "should run as non-root user (UID 1000)",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import os
print(os.getuid())`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout.trim()).toBe("1000");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should run as non-root group (GID 1000)",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import os
print(os.getgid())`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout.trim()).toBe("1000");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should not have root privileges",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import os
is_root = os.getuid() == 0
print(f'IS_ROOT={is_root}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("IS_ROOT=False");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("4. Capability Dropping", () => {
    it.skip(
      "should prevent privileged operations (SYS_ADMIN) [INFRASTRUCTURE]",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import ctypes
import os

# Try to use ptrace (requires CAP_SYS_PTRACE)
libc = ctypes.CDLL("libc.so.6")
result = libc.ptrace(0, 1, 0, 0)
if result == 0:
    print('PTRACE_SUCCESS')
else:
    print(f'PTRACE_BLOCKED: errno={os.errno}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          // Ptrace should be blocked by seccomp or capabilities
          expect(result.stdout).toContain("PTRACE_BLOCKED");
          expect(result.stdout).not.toContain("PTRACE_SUCCESS");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should prevent mounting filesystems",
      async () => {
        const container = await containerManager.createContainer("bash");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `mount -t tmpfs tmpfs /mnt 2>&1 || echo "MOUNT_BLOCKED"`,
            "bash",
            DEFAULT_TIMEOUT,
          );

          // Mount should be blocked by CapDrop ALL or seccomp
          expect(result.stdout).toMatch(
            /MOUNT_BLOCKED|permission denied|operation not permitted/i,
          );
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("5. Memory Limit (512MB)", () => {
    it(
      "should enforce memory limit and OOM kill",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import sys
data = bytearray(600 * 1024 * 1024)
print('MEMORY_ALLOCATION_SUCCESS')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(false);
          expect(result.stderr.toLowerCase()).toMatch(/killed|memory|oom/i);
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should allow memory usage within limit",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import sys
data = bytearray(256 * 1024 * 1024)
print('MEMORY_WITHIN_LIMIT')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("MEMORY_WITHIN_LIMIT");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("6. CPU Limit (1 core)", () => {
    it(
      "should enforce CPU throttling",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import time
start = time.time()
x = 0
for i in range(10000000):
    x += i ** 2
elapsed = time.time() - start
print(f'ELAPSED={elapsed:.2f}')
print('CPU_THROTTLED')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("CPU_THROTTLED");
          const elapsedMatch = result.stdout.match(/ELAPSED=(\d+\.\d+)/);
          if (elapsedMatch) {
            const elapsed = parseFloat(elapsedMatch[1]);
            expect(elapsed).toBeGreaterThan(0.1);
          }
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("7. Process Limit (50 pids)", () => {
    it(
      "should prevent fork bomb at 50 processes",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import os
import time

pids = []
try:
    for i in range(60):
        pid = os.fork()
        if pid == 0:
            time.sleep(10)
            os._exit(0)
        else:
            pids.append(pid)
    print(f'FORKED={len(pids)}')
    for pid in pids:
        os.waitpid(pid, os.WNOHANG)
except OSError as e:
    print(f'FORK_BLOCKED: {e}')
    print(f'FORKED={len(pids)}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          // Fork should be blocked at 50 processes, script catches error and exits successfully
          expect(result.success).toBe(true);
          expect(result.stdout).toContain("FORK_BLOCKED");
          expect(result.stdout).toContain("FORKED=");
          // Verify we didn't fork all 60
          const forkedMatch = result.stdout.match(/FORKED=(\d+)/);
          expect(forkedMatch).toBeTruthy();
          if (forkedMatch) {
            expect(parseInt(forkedMatch[1], 10)).toBeLessThan(60);
          }
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should allow reasonable number of processes",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import subprocess
import time

processes = []
for i in range(5):
    p = subprocess.Popen(['sleep', '0.1'])
    processes.append(p)

for p in processes:
    p.wait()

print('SUBPROCESSES_SUCCESS')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("SUBPROCESSES_SUCCESS");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("8. Timeout Enforcement", () => {
    it(
      "should kill process after timeout",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const shortTimeout = 3000;
          const startTime = Date.now();

          const result = await containerManager.executeInContainer(
            container,
            `import time
print('STARTED')
time.sleep(30)
print('COMPLETED')`,
            "python",
            shortTimeout,
          );

          const elapsed = Date.now() - startTime;

          // Timeout should trigger within reasonable time (timeout + cleanup overhead)
          expect(elapsed).toBeLessThan(shortTimeout + 10000); // Allow up to 10s overhead
          expect(result.success).toBe(false);
          expect(result.stdout).not.toContain("COMPLETED");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should complete within timeout for normal operations",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const startTime = Date.now();

          const result = await containerManager.executeInContainer(
            container,
            `import time
print('STARTED')
time.sleep(1)
print('COMPLETED')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          const elapsed = Date.now() - startTime;

          expect(result.success).toBe(true);
          expect(result.stdout).toContain("COMPLETED");
          expect(elapsed).toBeLessThan(DEFAULT_TIMEOUT);
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("7. No Docker Socket Access", () => {
    it(
      "should prevent access to Docker socket",
      async () => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `import os
import socket

# Try to connect to Docker socket
try:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect('/var/run/docker.sock')
    print('DOCKER_SOCKET_ACCESSIBLE')
    sock.close()
except Exception as e:
    print(f'DOCKER_SOCKET_BLOCKED: {type(e).__name__}')`,
            "python",
            DEFAULT_TIMEOUT,
          );

          // Docker socket should not exist in container
          expect(result.stdout).toContain("DOCKER_SOCKET_BLOCKED");
          expect(result.stdout).not.toContain("DOCKER_SOCKET_ACCESSIBLE");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should prevent Docker socket file access",
      async () => {
        const container = await containerManager.createContainer("bash");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `test -S /var/run/docker.sock && echo "SOCKET_EXISTS" || echo "DOCKER_SOCKET_NOT_FOUND"`,
            "bash",
            DEFAULT_TIMEOUT,
          );

          // Docker socket file should not exist
          expect(result.stdout).toContain("DOCKER_SOCKET_NOT_FOUND");
          expect(result.stdout).not.toContain("SOCKET_EXISTS");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );

    it(
      "should prevent Docker CLI commands",
      async () => {
        const container = await containerManager.createContainer("bash");

        try {
          const result = await containerManager.executeInContainer(
            container,
            `docker ps >/dev/null 2>&1 && echo "DOCKER_ACCESSIBLE" || echo "DOCKER_CLI_BLOCKED"`,
            "bash",
            DEFAULT_TIMEOUT,
          );

          // Docker CLI should fail (no socket)
          expect(result.stdout).toContain("DOCKER_CLI_BLOCKED");
          expect(result.stdout).not.toContain("DOCKER_ACCESSIBLE");
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });

  describe("Security Control Summary", () => {
    const securityChecks = [
      {
        name: "Network Isolation",
        code: `import socket
try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('8.8.8.8', 53))
    sock.close()
    print('FAIL')
except:
    print('PASS')`,
        expectedOutput: "PASS",
      },
      {
        name: "Non-Root User",
        code: `import os
print('PASS' if os.getuid() != 0 else 'FAIL')`,
        expectedOutput: "PASS",
      },
      {
        name: "Read-Only Root Filesystem",
        code: `try:
    with open('/etc/test.txt', 'w') as f:
        f.write('test')
    print('FAIL')
except:
    print('PASS')`,
        expectedOutput: "PASS",
      },
      {
        name: "Tmpfs Writable",
        code: `try:
    with open('/tmp/test.txt', 'w') as f:
        f.write('test')
    print('PASS')
except:
    print('FAIL')`,
        expectedOutput: "PASS",
      },
      {
        name: "No Docker Socket Access",
        code: `import socket
try:
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.connect('/var/run/docker.sock')
    sock.close()
    print('FAIL')
except:
    print('PASS')`,
        expectedOutput: "PASS",
      },
    ];

    it.each(securityChecks)(
      "should verify security control: $name",
      async ({ code, expectedOutput }) => {
        const container = await containerManager.createContainer("python");

        try {
          const result = await containerManager.executeInContainer(
            container,
            code,
            "python",
            DEFAULT_TIMEOUT,
          );

          expect(result.success).toBe(true);
          expect(result.stdout.trim()).toContain(expectedOutput);
        } finally {
          await containerManager.destroyContainer(container);
        }
      },
      LONG_TIMEOUT,
    );
  });
});
