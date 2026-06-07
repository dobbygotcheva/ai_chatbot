# GitLab CI/CD Setup Checklist

Follow these steps to configure the CI/CD pipeline for your AI Chatbot.

---

## Prerequisites

- [x] GitLab instance with admin access
- [x] GitLab Runner installed on your deployment server
- [x] Docker installed on the deployment server
- [x] Your repository pushed to GitLab

---

## Step 1: Configure GitLab Runner (On Your Server)

### 1.1 Install GitLab Runner (if not installed)

```bash
# Add GitLab repository
curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | sudo bash

# Install runner
sudo apt-get install gitlab-runner

# Register the runner
sudo gitlab-runner register
```

### 1.2 Register the Runner

When prompted, use these settings:

```
GitLab instance URL: https://gitlab.com/ (or your self-hosted URL)
Registration token: <get from GitLab Admin → Runners>
Runner description: ai-center-deploy
Tags: docker,deploy
Executor: shell
```

### 1.3 Grant Docker Access

```bash
# Add gitlab-runner user to docker group
sudo usermod -aG docker gitlab-runner

# Verify group membership
groups gitlab-runner

# Restart the runner service
sudo systemctl restart gitlab-runner

# Enable runner to start on system boot (should be automatic)
sudo systemctl enable gitlab-runner
```

### 1.4 Verify Runner Status

```bash
# Check runner is running
sudo systemctl status gitlab-runner

# Test docker access
sudo -u gitlab-runner docker ps

# Verify auto-start is enabled
systemctl is-enabled gitlab-runner
# Should output: enabled
```

### 1.5 System Service Information

The GitLab Runner runs as a **systemd service**, which means:
- It starts automatically when the system boots
- It runs in the background without manual intervention
- You don't need to run `gitlab-runner run` manually

```bash
# View service logs
sudo journalctl -u gitlab-runner -f

# Stop the service
sudo systemctl stop gitlab-runner

# Start the service
sudo systemctl start gitlab-runner

# Check if service is enabled on boot
systemctl is-enabled gitlab-runner
```

---

## Step 2: Configure CI/CD Variables in GitLab

### 2.1 Navigate to Variables

1. Go to your GitLab project
2. **Settings → CI/CD**
3. Expand **Variables** section
4. Click **Add variable** for each variable below

### 2.2 Add Staging Variables

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `AUTH_SECRET_STAGING` | `openssl rand -base64 32` | ❌ | ✅ |
| `PROVIDER_API_KEY_STAGING` | Your staging API key | ❌ | ✅ |
| `PROVIDER_BASE_URL_STAGING` | `https://api.provider.com` | ❌ | ❌ |
| `PROVIDER_MODEL_STAGING` | Your model ID | ❌ | ❌ |
| `PROVIDER_TITLE_MODEL_STAGING` | Title model (optional) | ❌ | ❌ |
| `PROVIDER_ARTIFACT_MODEL_STAGING` | Artifact model (optional) | ❌ | ❌ |
| `PROVIDER_REASONING_MODEL_STAGING` | Reasoning model (optional) | ❌ | ❌ |
| `PROVIDER_EMBEDDING_MODEL_STAGING` | `embedding` | ❌ | ❌ |

### 2.3 Add Production Variables

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `AUTH_SECRET_PROD` | `openssl rand -base64 32` | ✅ | ✅ |
| `AUTH_URL_PROD` | `https://your-domain.com` | ❌ | ❌ |
| `PROVIDER_API_KEY_PROD` | Your production API key | ✅ | ✅ |
| `PROVIDER_BASE_URL_PROD` | `https://api.provider.com` | ❌ | ❌ |
| `PROVIDER_MODEL_PROD` | Your model ID | ❌ | ❌ |
| `PROVIDER_TITLE_MODEL_PROD` | Title model (optional) | ❌ | ❌ |
| `PROVIDER_ARTIFACT_MODEL_PROD` | Artifact model (optional) | ❌ | ❌ |
| `PROVIDER_REASONING_MODEL_PROD` | Reasoning model (optional) | ❌ | ❌ |
| `PROVIDER_EMBEDDING_MODEL_PROD` | `embedding` | ❌ | ❌ |

### 2.4 Generate AUTH_SECRET

```bash
# Generate secure random secrets
openssl rand -base64 32
```

---

## Step 3: Configure GitLab Registry (Optional but Recommended)

### 3.1 Enable Container Registry

1. Go to **Settings → General**
2. Expand **Visibility, project features, permissions**
3. Enable **Container Registry**
4. Save changes

### 3.2 Get Registry Credentials

The CI/CD uses built-in variables:
- `CI_REGISTRY` - Registry URL (e.g., `registry.gitlab.com`)
- `CI_REGISTRY_USER` - Bot username
- `CI_REGISTRY_PASSWORD` - Bot password
- `CI_REGISTRY_IMAGE` - Full image path

---

## Step 4: Protect Branches (Recommended)

### 4.1 Protect `main` Branch

1. Go to **Settings → Repository**
2. Expand **Protected branches**
3. Select `main` branch
4. Allowed to merge: **Maintainers**
5. Allowed to push: **Maintainers**
6. Click **Protect**

### 4.2 Protect `development` Branch (Optional)

1. Same as above, select `development`
2. Allowed to merge: **Developers + Maintainers**
3. Allowed to push: **Developers + Maintainers**

---

## Step 5: First Pipeline Run

### 5.1 Push to GitLab

```bash
# Add all files
git add .

# Commit
git commit -m "Add Docker and CI/CD configuration"

# Push to development branch
git push origin development
```

### 5.2 Monitor Pipeline

1. Go to **Build → Pipelines**
2. Click on the running pipeline
3. Watch each stage complete:
   - lint ✅
   - test ✅
   - build ✅
   - deploy-staging ✅

### 5.3 Verify Deployment

```bash
# SSH to your server
ssh your-server

# Check containers are running
docker compose -f docker-compose.staging.yml ps

# Check staging is accessible
curl http://localhost:3001/api/health

# View logs
docker compose -f docker-compose.staging.yml logs -f ai-chatbot
```

---

## Step 6: Deploy to Production

### 6.1 Merge to Main

```bash
# Create merge request in GitLab UI
# OR merge directly if you have permissions

git checkout main
git merge development
git push origin main
```

### 6.2 Verify Production Deployment

```bash
# Check containers
docker compose -f docker-compose.prod.yml ps

# Check production is accessible
curl http://localhost:3000/api/health

# View logs
docker compose -f docker-compose.prod.yml logs -f ai-chatbot
```

---

## Step 7: Configure Image Cleanup (Cron Job)

Add a cron job to clean up old Docker images:

```bash
# Edit crontab
sudo crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * docker image prune -f --filter "until=24h"
```

---

## Troubleshooting

### Runner Not Picking Up Jobs

```bash
# Check runner status
sudo gitlab-runner status

# Check logs
sudo journalctl -u gitlab-runner -f

# Verify tags match
# In .gitlab-ci.yml, ensure tags match runner registration
```

### Docker Permission Denied

```bash
# Verify user is in docker group
groups gitlab-runner

# Restart runner after group change
sudo systemctl restart gitlab-runner

# Test docker access
sudo -u gitlab-runner docker ps
```

### Pipeline Fails at Build Stage

```bash
# Check disk space
df -h

# Clean up old images manually
docker image prune -af

# Check registry authentication
docker login $CI_REGISTRY
```

### Deployment Fails

```bash
# Check environment variables are set
printenv | grep -E "AUTH_SECRET|PROVIDER"

# Verify compose files exist
ls -la docker-compose.*.yml

# Manual deployment test
docker compose -f docker-compose.staging.yml up -d
```

---

## Security Best Practices

- [x] Use **masked variables** for secrets
- [x] Use **protected variables** for production secrets
- [x] Protect `main` branch
- [x] Require merge request approvals
- [x] Limit runner permissions to minimum required
- [ ] Regular security updates on server
- [ ] Firewall rules: only expose necessary ports (3000, 3001)

---

## Quick Reference

### Commands

```bash
# View staging logs
docker compose -f docker-compose.staging.yml logs -f

# View production logs
docker compose -f docker-compose.prod.yml logs -f

# Restart staging
docker compose -f docker-compose.staging.yml restart ai-chatbot

# Restart production
docker compose -f docker-compose.prod.yml restart ai-chatbot

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Cleanup old images
docker image prune -f --filter "until=24h"
```

### URLs

| Environment | URL | Port |
|-------------|-----|------|
| Staging | http://your-server:3001 | 3001 |
| Production | http://your-server:3000 | 3000 |

---

## Next Steps After Setup

1. Configure domain and SSL (nginx/traefik reverse proxy)
2. Set up monitoring (Prometheus, Grafana)
3. Configure log aggregation
4. Set up alerts for failed deployments
5. Configure backup strategy for databases
