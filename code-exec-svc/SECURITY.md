# Security Hardening Guide

This document describes the security architecture of the Code Execution Service, including the threat model, security controls, and incident response procedures.

---

## Threat Model

### Assets Protected

| Asset | Description |
|-------|-------------|
| **Host System Integrity** | Prevent unauthorized access or modification of the host OS |
| **Other Containers** | Isolate execution from other running containers |
| **Network Resources** | Prevent unauthorized network access and data exfiltration |
| **User Data** | Protect sensitive data from unauthorized access |

### Threat Actors

| Actor | Motivation |
|-------|------------|
| **Malicious Code Execution** | Deliberate attempts to exploit the execution environment |
| **Accidental Resource Exhaustion** | Poorly written code causing DoS |
| **Data Exfiltration Attempts** | Attempts to steal data via network or filesystem |

### Attack Vectors Mitigated

| Vector | Mitigation |
|--------|------------|
| **Container Escape** | Non-root user, capability dropping, seccomp |
| **Privilege Escalation** | CapDrop ALL, read-only filesystem |
| **Network-based Attacks** | Network disabled, no outbound connections |
| **Resource Exhaustion (DoS)** | Memory, CPU, process limits |
| **Persistence Mechanisms** | Read-only root filesystem, ephemeral containers |

---

## Security Controls (9 Layers)

### 1. Non-Root Execution

```yaml
User: '1001:1001'
```

| Property | Value |
|----------|-------|
| **UID/GID** | 1001:1001 |
| **Purpose** | Prevent root-level operations inside container |
| **Mitigation** | Container escape with root privileges, privilege escalation |

**Why it matters**: Running as non-root ensures that even if an attacker escapes the container, they don't gain root access to the host system.

---

### 2. Network Isolation

```yaml
NetworkDisabled: true
```

| Property | Value |
|----------|-------|
| **Network Access** | Completely disabled |
| **Purpose** | No outbound or inbound network access |
| **Mitigation** | Data exfiltration, command-and-control (C2) communication, lateral movement |

**Why it matters**: Network isolation prevents attackers from:
- Exfiltrating sensitive data
- Downloading additional malware
- Communicating with external C2 servers
- Attacking other services on the network

---

### 3. Read-Only Filesystem

```yaml
ReadonlyRootfs: true
```

| Property | Value |
|----------|-------|
| **Root Filesystem** | Read-only |
| **Writable Locations** | `/tmp` (tmpfs mount, 100MB limit) |
| **Purpose** | Immutable root filesystem |
| **Mitigation** | Malware persistence, binary modification, configuration tampering |

**Why it matters**: A read-only filesystem prevents:
- Installing persistent backdoors
- Modifying system binaries
- Changing configuration files
- Dropping malicious scripts in system directories

---

### 4. Capability Dropping

```yaml
CapDrop: ['ALL']
```

| Property | Value |
|----------|-------|
| **Capabilities** | All dropped |
| **Purpose** | Remove all Linux capabilities |
| **Mitigation** | Privilege escalation via capabilities, kernel exploitation |

**Dropped capabilities include**:
- `CAP_SYS_ADMIN` - Mount filesystems, access namespaces
- `CAP_NET_ADMIN` - Modify network configuration
- `CAP_SYS_PTRACE` - Debug processes (ptrace attacks)
- `CAP_SYS_MODULE` - Load kernel modules
- `CAP_SETUID`/`CAP_SETGID` - Change user/group IDs

**Why it matters**: Linux capabilities provide fine-grained privileges. Dropping all capabilities ensures the container cannot perform privileged operations even if it escapes other restrictions.

---

### 5. Seccomp Profile

```yaml
SecurityOpt: ['seccomp=/path/to/seccomp-profile.json']
```

| Property | Value |
|----------|-------|
| **Profile Location** | `code-exec-svc/seccomp-profile.json` |
| **Approach** | Whitelist-based (default DENY) |
| **Allowed Syscalls** | ~200 safe syscalls |
| **Purpose** | Block dangerous syscalls at kernel level |
| **Mitigation** | Kernel exploitation, ptrace attacks, container escape |

**Allowed Syscall Categories**:

| Category | Examples |
|----------|----------|
| **File I/O** | `open`, `read`, `write`, `close`, `stat`, `fstat` |
| **Memory** | `mmap`, `munmap`, `mprotect`, `brk` |
| **Process** | `exit`, `exit_group`, `gettid`, `getpid` |
| **Network** | BLOCKED (none allowed) |

**Blocked Dangerous Syscalls**:

| Syscall | Risk |
|---------|------|
| `ptrace` | Process debugging/tracing, credential stealing |
| `mount`, `umount` | Filesystem manipulation, escape attempts |
| `reboot` | System control, DoS |
| `init_module`, `delete_module` | Kernel module loading (rootkits) |
| `setuid`, `setgid` | Privilege escalation |
| `chroot`, `pivot_root` | Filesystem escape attempts |

**Why it matters**: Seccomp (Secure Computing Mode) is a Linux kernel feature that filters syscalls. Our whitelist approach means any syscall not explicitly allowed will be blocked, providing a strong defense against kernel-level attacks.

---

### 6. Memory Limit

```yaml
Memory: 536870912  # 512MB
```

| Property | Value |
|----------|-------|
| **Limit** | 512 MB (536,870,912 bytes) |
| **Enforcement** | OOM killer |
| **Purpose** | Prevent memory exhaustion attacks |
| **Mitigation** | OOM attacks, resource hogging, memory-based DoS |

**Why it matters**: Memory limits prevent:
- Single executions from consuming all available memory
- Memory exhaustion attacks affecting other containers
- System instability due to memory pressure

---

### 7. CPU Limit

```yaml
CpuQuota: 100000  # 1 core (100000 microseconds)
```

| Property | Value |
|----------|-------|
| **Limit** | 1 CPU core (100% of one core) |
| **Period** | 100,000 microseconds |
| **Purpose** | Prevent CPU exhaustion |
| **Mitigation** | DoS via CPU saturation, crypto mining |

**Why it matters**: CPU limits ensure:
- Fair resource sharing between executions
- Protection against CPU-intensive attacks (crypto mining, hash cracking)
- System stability under load

---

### 8. Process Limit

```yaml
PidsLimit: 50
```

| Property | Value |
|----------|-------|
| **Limit** | 50 processes |
| **Purpose** | Prevent fork bomb attacks |
| **Mitigation** | Process exhaustion, fork bombs, resource starvation |

**Why it matters**: Process limits prevent:
- Fork bomb attacks that exhaust system PID space
- Process table exhaustion
- Resource starvation affecting other containers

---

### 9. Execution Timeout

```yaml
Timeout: 30000  # 30 seconds (default)
```

| Property | Value |
|----------|-------|
| **Default** | 30 seconds |
| **Configurable** | Yes (per-request) |
| **Purpose** | Prevent infinite loops and long-running executions |
| **Mitigation** | Hang attacks, resource locking, DoS |

**Why it matters**: Timeouts ensure:
- Executions always complete (or are terminated)
- Resources are released promptly
- Protection against infinite loops and blocking operations

---

## Seccomp Profile Details

**Location**: `code-exec-svc/seccomp-profile.json`

### Profile Structure

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "defaultErrnoRet": 1,
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_AARCH64"
  ],
  "syscalls": [...]
}
```

### Default Action

- **Action**: `SCMP_ACT_ERRNO` (return error)
- **Error Code**: `1` (EPERM - Operation not permitted)
- **Meaning**: Any syscall not explicitly whitelisted will fail with "Operation not permitted"

### Explicitly Blocked Syscalls

The following syscalls are explicitly blocked with `SCMP_ACT_ERRNO`:

| Category | Syscalls |
|----------|----------|
| **Process Tracing** | `ptrace`, `process_vm_readv`, `process_vm_writev` |
| **Filesystem Mount** | `mount`, `umount`, `umount2`, `pivot_root`, `chroot` |
| **System Control** | `reboot`, `kexec_load`, `kexec_file_load` |
| **Kernel Modules** | `init_module`, `finit_module`, `delete_module` |
| **System Accounting** | `acct` |
| **Hostname/Domain** | `sethostname`, `setdomainname` |
| **I/O Privileges** | `iopl`, `ioperm`, `create_module`, `get_kernel_syms`, `query_module` |
| **Unused/Reserved** | `nfsservctl`, `getpmsg`, `putpmsg`, `afs_syscall`, `tuxcall`, `security`, `lookup_dcookie`, `vserver`, `sys_fsmc`, `sys_seccomp`, `sys_calls` |

---

## Known Limitations

### 1. Side-Channel Attacks

**Risk**: Timing attacks, cache-based side channels

**Description**: The current implementation does not protect against side-channel attacks. Malicious code could potentially:
- Measure execution timing to infer information about other processes
- Use CPU cache timing to extract sensitive data
- Exploit speculative execution vulnerabilities (Spectre, Meltdown)

**Mitigation**: Consider running untrusted code on isolated hardware or using specialized sandboxing technologies (gVisor, Kata Containers) for high-security scenarios.

---

### 2. Shared Resources

**Risk**: CPU cache, memory bandwidth, I/O bandwidth

**Description**: Containers share underlying hardware resources:
- CPU cache (L1, L2, L3)
- Memory bandwidth
- Disk I/O bandwidth
- Network interface (host-level)

**Mitigation**: Resource limits help, but sophisticated attackers could potentially use resource contention as a side channel.

---

### 3. Docker Daemon Trust

**Risk**: Compromised Docker daemon = full host access

**Description**: If the Docker daemon itself is compromised, all security controls become ineffective. The Docker daemon runs as root and has full control over containers.

**Mitigation**:
- Keep Docker daemon updated
- Run Docker daemon with minimal privileges
- Consider rootless Docker for additional isolation
- Monitor Docker daemon logs for suspicious activity

---

### 4. Kernel Vulnerabilities

**Risk**: Zero-day kernel exploits

**Description**: Security controls rely on kernel enforcement. A kernel vulnerability (zero-day) could potentially bypass all container isolation.

**Mitigation**:
- Keep kernel updated with security patches
- Use security modules (AppArmor, SELinux) in addition to seccomp
- Monitor for kernel exploits in the wild

---

### 5. Image Integrity

**Risk**: Compromised base images

**Description**: The security of the execution environment depends on the integrity of the base Docker images. A compromised image could contain backdoors.

**Mitigation**:
- Use official, verified base images
- Implement image scanning in CI/CD
- Sign and verify images
- Regularly rebuild images with updated dependencies

---

## Incident Response

### If Container Escape Detected

#### Step 1: Isolate

Stop all containers immediately:

```bash
docker stop $(docker ps -q)
```

#### Step 2: Investigate

Check container logs for suspicious activity:

```bash
docker logs ai-chatbot-code-exec-svc
```

#### Step 3: Audit

Review execution logs for suspicious patterns:
- Unusual file access attempts
- Repeated execution failures
- High resource usage patterns
- Seccomp violations

```bash
# Check Docker daemon logs
journalctl -u docker -n 1000

# Check for seccomp violations
dmesg | grep -i seccomp
```

#### Step 4: Report

Document findings with:
- Timestamps of suspicious activity
- Affected containers and hosts
- Execution logs and error messages
- Potential impact assessment

---

### Monitoring Recommendations

| Alert | Threshold | Action |
|-------|-----------|--------|
| **Execution Failures** | > 10/minute | Review logs for patterns |
| **Resource Limit Violations** | Any | Investigate potential abuse |
| **Seccomp Violations** | Any | Critical - potential escape attempt |
| **Unusual Execution Patterns** | Anomaly detection | Review code submissions |

### Recommended Monitoring Tools

- **Docker Stats**: Real-time resource usage
- **Prometheus/Grafana**: Metrics collection and alerting
- **ELK Stack**: Log aggregation and analysis
- **Falco**: Runtime security monitoring

---

## Security Testing

Run security tests regularly to verify controls:

```bash
cd code-exec-svc
pnpm test:integration tests/security.test.ts
```

### Test Coverage

| Security Control | Test Coverage |
|------------------|---------------|
| Network Isolation | ✅ Tested |
| Read-only Filesystem | ✅ Tested |
| Non-root User | ✅ Tested |
| Capability Dropping | ✅ Tested |
| Memory Limit | ✅ Tested |
| CPU Limit | ✅ Tested |
| Process Limit | ✅ Tested |
| Timeout Enforcement | ✅ Tested |

---

## Compliance Notes

### OWASP

This implementation follows OWASP guidelines for code execution security:
- **Input Validation**: All code submissions validated before execution
- **Sandboxing**: Multi-layer isolation (Docker + seccomp + capabilities)
- **Resource Limits**: Memory, CPU, process, and time limits enforced
- **Logging**: All executions logged for audit purposes

### CIS Docker Benchmark

Aligned with CIS Docker Community Edition Benchmark v1.5.0:
- **4.1**: Ensure a user for the container has been created
- **5.2**: Verify that SELinux/AppArmor security options are set
- **5.3**: Ensure Linux kernel capabilities are restricted
- **5.4**: Ensure privileged containers are not used
- **5.25**: Ensure the container is restricted from acquiring additional privileges

### NIST

Maps to NIST SP 800-190 (Application Container Security Guide):
- **Container Isolation**: Multi-layer isolation controls
- **Resource Management**: Enforced resource limits
- **Monitoring**: Execution logging and alerting
- **Incident Response**: Documented response procedures

---

## Security Checklist

Before deploying to production, verify:

- [ ] All 9 security controls are enabled
- [ ] Seccomp profile is loaded and active
- [ ] Base images are from trusted sources
- [ ] Monitoring and alerting are configured
- [ ] Incident response procedures are documented
- [ ] Security tests pass regularly
- [ ] Docker daemon is updated and hardened
- [ ] Kernel is updated with security patches

---

## Contact

For security concerns or vulnerability reports, contact the security team.

**Last Updated**: 2026-04-03
**Version**: 1.0
