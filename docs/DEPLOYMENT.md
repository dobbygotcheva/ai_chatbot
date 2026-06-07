# Deployment Guide

This document describes how to deploy the AI Chatbot application with separate staging and production environments.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                          Your Server                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                      Nginx (Reverse Proxy)           │  │
│  │                   SSL Termination & Routing          │  │
│  │              Port 443 → localhost:3000/3001          │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                             │
│              ┌───────────────┴──────────────┐              │
│              │                              │              │
│  ┌───────────▼────────┐          ┌──────────▼──────────┐   │
│  │  Staging           │          │   Production        │   │
│  │  Environment       │          │   Environment       │   │
│  │  ┌──────────────┐  │          │  ┌──────────────┐   │   │
│  │  │  ai-chatbot  │  │          │  │  ai-chatbot  │   │   │
│  │  │    :3001     │  │          │  │    :3000     │   │   │
│  │  └──────────────┘  │          │  └──────────────┘   │   │
│  │         │          │          │         │           │   │
│  │  ┌─────▼─────┐     │          │  ┌──────▼──────┐    │   │
│  │  │ postgres  │     │          │  │  postgres   │    │   │
│  │  │  :5432    │     │          │  │   :5432     │    │   │
│  │  └───────────┘     │          │  └─────────────┘    │   │
│  │         │          │          │         │           │   │
│  │  ┌─────▼─────┐     │          │  ┌──────▼──────┐    │   │
│  │  │  qdrant   │     │          │  │   qdrant    │    │   │
│  │  │  :6341    │     │          │  │   :6342     │    │   │
│  │  └───────────┘     │          │  └─────────────┘    │   │
│  │         │          │          │         │           │   │
│  │  ┌─────▼─────┐     │          │  ┌──────▼──────┐    │   │
│  │  │  crawl4ai │     │          │  │  crawl4ai   │    │   │
│  │  │  :11235   │     │          │  │   :11235    │    │   │
│  │  └───────────┘     │          │  └─────────────┘    │   │
│  │         │          │          │         │           │   │
│  │  ┌─────▼─────┐     │          │  ┌──────▼──────┐    │   │
│  │  │mcp-atl-   │     │          │  │mcp-atl-     │    │   │
│  │  │ atlassian │     │          │  │ atlassian   │    │   │
│  │  │  :8000    │     │          │  │   :8000     │    │   │
│  │  └───────────┘     │          │  └─────────────┘    │   │
│  └────────────────────┘          └─────────────────────┘   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                      GitLab Runner                   │  │
│  │  - Builds Docker images                              │  │
│  │  - Deploys via docker-compose                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Branch Strategy

| Branch        | Environment  | Port | Domain | Auto-Deploy |
| ------------- | ------------ | ---- | ------ | ----------- |
| `development` | Staging      | 3001 | `ai-center-test.egt.com` | ✅ Yes      |
| `main`        | Production   | 3000 | `ai-center.egt.com` | ✅ Yes      |

## Files Created

| File                                          | Purpose                     |
| --------------------------------------------- | --------------------------- |
| [`ai_chatbot/Dockerfile`](ai_chatbot/Dockerfile) | Multi-stage Docker build    |
| [`docker-compose.staging.yml`](docker-compose.staging.yml) | Staging environment config  |
| [`docker-compose.prod.yml`](docker-compose.prod.yml) | Production environment config |
| [`.gitlab-ci.yml`](.gitlab-ci.yml) | CI/CD pipeline              |
| [`nginx/nginx.conf`](nginx/nginx.conf) | Nginx main configuration    |
| [`nginx/ai-center.conf`](nginx/ai-center.conf) | Nginx virtual hosts         |
| [`scripts/setup-nginx.sh`](scripts/setup-nginx.sh) | One-time nginx setup script |

---

## Part 1: Nginx Reverse Proxy Setup (One-Time)

Nginx serves as a reverse proxy to route traffic to staging and production environments with SSL termination.

### Domain Routing

| Domain | Backend | Environment |
|--------|---------|-------------|
| `https://ai-center.egt.com` | `localhost:3000` | Production |
| `https://ai-center-test.egt.com` | `localhost:3001` | Staging |

### Quick Setup

1. **Upload SSL certificates** (from your local machine):
   ```bash
   scp egt.com-bundle.crt egt.com.key egt.com.crt user@server:/tmp/
   ```

2. **SSH to server and run setup**:
   ```bash
   ssh user@server
   git clone <repository-url> /path/to/ai_center
   cd /path/to/ai_center
   sudo ./scripts/setup-nginx.sh
   ```

That's it! The script handles everything.

### What the Setup Script Does

The `scripts/setup-nginx.sh` script automates:

1. ✅ Installs nginx (if not present)
2. ✅ Creates `/etc/nginx/ssl` directory (permissions: 700)
3. ✅ Copies nginx configuration files
4. ✅ Sets certificate permissions (key: 600, certs: 644)
5. ✅ Tests nginx configuration
6. ✅ Enables and starts nginx service
7. ✅ Configures UFW firewall (if active)

### Manual Setup (Optional)

If you prefer manual setup:

#### 1. Install Nginx
```bash
sudo apt-get update && sudo apt-get install -y nginx
```

#### 2. Create SSL Directory
```bash
sudo mkdir -p /etc/nginx/ssl
sudo chmod 700 /etc/nginx/ssl
```

#### 3. Move Certificates
```bash
sudo mv /tmp/egt.com* /etc/nginx/ssl/
sudo chmod 600 /etc/nginx/ssl/egt.com.key
sudo chmod 644 /etc/nginx/ssl/egt.com-bundle.crt
sudo chmod 644 /etc/nginx/ssl/egt.com.crt
```

#### 4. Copy Configuration
```bash
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp nginx/ai-center.conf /etc/nginx/conf.d/ai-center.conf
```

#### 5. Test and Start
```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

#### 6. Configure Firewall
```bash
sudo ufw allow 'Nginx Full'
```

### Updating Nginx Configuration

When you update nginx config files in the repo:

```bash
# Pull latest changes
cd /path/to/ai_center
git pull

# Run setup script (copies files and reloads nginx)
sudo ./scripts/setup-nginx.sh
```

Or manually reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Testing Nginx

```bash
# Test HTTP → HTTPS redirect
curl -I http://ai-center.egt.com
# Expected: 301 Moved Permanently → https://

# Test HTTPS
curl -I https://ai-center.egt.com
# Expected: 200 OK

# Test staging
curl -I https://ai-center-test.egt.com
# Expected: 200 OK
```

### Nginx Monitoring

```bash
# Access log
sudo tail -f /var/log/nginx/access.log

# Error log
sudo tail -f /var/log/nginx/error.log

# Systemd journal
sudo journalctl -u nginx -f

# Check status
sudo systemctl status nginx
```

### Nginx Troubleshooting

```bash
# Check configuration syntax
sudo nginx -t

# Check error logs
sudo journalctl -u nginx -n 50 --no-pager

# Check if ports are in use
sudo netstat -tlnp | grep ':80\|:443'

# Verify certificates
ls -la /etc/nginx/ssl/
openssl x509 -in /etc/nginx/ssl/egt.com-bundle.crt -enddate -noout
```

### Nginx Security

**Certificate Permissions:**

| File | Permissions | Owner |
|------|-------------|-------|
| `/etc/nginx/ssl/` | `700` | `root:root` |
| `egt.com.key` | `600` | `root:root` |
| `egt.com-bundle.crt` | `644` | `root:root` |
| `egt.com.crt` | `644` | `root:root` |

**SSL/TLS Configuration:**
- Protocols: TLS 1.2, TLS 1.3 only
- Ciphers: ECDHE (forward secrecy)
- HTTP/2: Enabled
- Session cache: 10 minutes
- Session tickets: Disabled (forward secrecy)

---

## Part 2: GitLab CI/CD Setup

### Configure GitLab CI/CD Variables

In your GitLab project, go to **Settings → CI/CD → Variables** and add:

#### Required for Staging
```
AUTH_SECRET_STAGING          # openssl rand -base64 32
PROVIDER_API_KEY_STAGING
PROVIDER_BASE_URL_STAGING
PROVIDER_MODEL_STAGING
```

#### Required for Production
```
AUTH_SECRET_PROD             # openssl rand -base64 32
AUTH_URL_PROD                # https://ai-center.egt.com
PROVIDER_API_KEY_PROD
PROVIDER_BASE_URL_PROD
PROVIDER_MODEL_PROD
```

#### Optional (all environments)
```
PROVIDER_TITLE_MODEL_STAGING
PROVIDER_ARTIFACT_MODEL_STAGING
PROVIDER_REASONING_MODEL_STAGING
PROVIDER_EMBEDDING_MODEL_STAGING

PROVIDER_TITLE_MODEL_PROD
PROVIDER_ARTIFACT_MODEL_PROD
PROVIDER_REASONING_MODEL_PROD
PROVIDER_EMBEDDING_MODEL_PROD
```

### Configure GitLab Runner

The GitLab Runner runs as a **systemd service** that starts automatically on system boot.

```bash
# Check runner status
sudo systemctl status gitlab-runner

# Verify it's enabled for auto-start
systemctl is-enabled gitlab-runner
# Should output: enabled
```

Ensure your GitLab runner has Docker access:

```bash
# Add gitlab-runner user to docker group
sudo usermod -aG docker gitlab-runner

# Restart the runner
sudo systemctl restart gitlab-runner
```

> **Note:** You do NOT need to run `gitlab-runner run` manually. The systemd service handles this automatically.

---

## Part 3: Application Deployment

### Local Development

#### Run Staging Locally

```bash
# Build and start all staging services
docker compose -f docker-compose.staging.yml up -d --build

# View logs
docker compose -f docker-compose.staging.yml logs -f ai-chatbot

# Stop all services
docker compose -f docker-compose.staging.yml down
```

Access: http://localhost:3001

#### Run Production Locally

```bash
# Build and start all production services
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f ai-chatbot

# Stop all services
docker compose -f docker-compose.prod.yml down
```

Access: http://localhost:3000

### Manual Deployment (On Server)

#### Deploy Staging Manually

```bash
# On the server
cd /path/to/ai_center

# Set environment variables
export AUTH_SECRET_STAGING="..."
export PROVIDER_API_KEY_STAGING="..."

# Deploy
docker compose -f docker-compose.staging.yml up -d --build

# Check status
docker compose -f docker-compose.staging.yml ps
```

#### Deploy Production Manually

```bash
# On the server
cd /path/to/ai_center

# Set environment variables
export AUTH_SECRET_PROD="..."
export PROVIDER_API_KEY_PROD="..."

# Deploy
docker compose -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.prod.yml ps
```

---

## CI/CD Pipeline

### Pipeline Stages

```
lint → test → build → deploy-staging → deploy-prod
```

### Stage Details

| Stage | Description | Trigger |
|-------|-------------|---------|
| `lint` | Run `pnpm lint` | MR, development, main |
| `test` | Run `pnpm test` | MR, development, main |
| `build` | Build & push Docker image | development, main |
| `deploy-staging` | Deploy to staging | development (auto) |
| `deploy-prod` | Deploy to production | main (auto) |

---

## Monitoring & Maintenance

### View Logs

```bash
# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Staging application logs
docker compose -f docker-compose.staging.yml logs -f ai-chatbot

# Production application logs
docker compose -f docker-compose.prod.yml logs -f ai-chatbot

# All services
docker compose -f docker-compose.staging.yml logs -f
```

### Health Check

```bash
# Nginx is routing correctly
curl -I https://ai-center.egt.com
curl -I https://ai-center-test.egt.com

# Backend health (through nginx)
curl https://ai-center.egt.com/api/health
curl https://ai-center-test.egt.com/api/health

# Direct backend health (on server)
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

### Resource Usage

```bash
# Check container resources
docker stats ai-chatbot-staging
docker stats ai-chatbot-prod

# Check nginx
sudo systemctl status nginx
```

### Cleanup Old Images

```bash
# Remove images older than 24 hours
docker image prune -f --filter "until=24h"

# Remove all unused images
docker image prune -af
```

### Restart Services

```bash
# Restart staging
docker compose -f docker-compose.staging.yml restart ai-chatbot

# Restart production
docker compose -f docker-compose.prod.yml restart ai-chatbot

# Restart nginx
sudo systemctl restart nginx
```

---

## Troubleshooting

### Nginx Issues

```bash
# Check configuration
sudo nginx -t

# Check logs
sudo journalctl -u nginx -f

# Verify certificates
ls -la /etc/nginx/ssl/
openssl x509 -in /etc/nginx/ssl/egt.com-bundle.crt -text -noout | grep -A1 "Subject Alternative Name"
```

### Container Won't Start

```bash
# Check logs
docker logs ai-chatbot-staging
docker logs ai-chatbot-prod

# Check if ports are in use
netstat -tlnp | grep 3001
netstat -tlnp | grep 3000

# Force recreate
docker compose -f docker-compose.staging.yml up -d --force-recreate
```

### Database Connection Issues

```bash
# Check postgres is running
docker compose -f docker-compose.staging.yml ps postgres

# Test connection
docker compose -f docker-compose.staging.yml exec postgres psql -U postgres -d ai_chatbot_staging -c "SELECT 1"
```

### Migration Failures

```bash
# Run migrations manually
docker compose -f docker-compose.staging.yml exec ai-chatbot pnpm db:migrate
```

### Backend Not Reachable Through Nginx

```bash
# Test backend directly
curl -I http://localhost:3000
curl -I http://localhost:3001

# Check nginx is running
sudo systemctl status nginx

# Check nginx can reach backend
sudo nginx -t
sudo systemctl reload nginx
```

---

## Security Considerations

1. **Never commit `.env` files** - Use GitLab CI/CD variables
2. **Use strong secrets** - `openssl rand -base64 32` for AUTH_SECRET
3. **Limit runner permissions** - Only necessary Docker access
4. **Firewall configuration** - Only expose ports 80, 443, 22
5. **Regular updates** - Keep base images and nginx updated
6. **Certificate security** - Private key permissions (600), SSL directory (700)
7. **TLS configuration** - Modern protocols only (TLS 1.2+)

---

## Scaling

### Increase Resources

Edit `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '8.0'      # Increase CPU limit
      memory: 8G       # Increase memory limit
```

### Add Replicas (Advanced)

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
```

---

## Rollback

### Rollback to Previous Commit

```bash
# Find previous working image
docker images | grep ai-chatbot

# Deploy specific image tag
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Quick Rollback Command

```bash
# Restart with previous image
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Rollback Nginx Configuration

```bash
# If nginx config update caused issues, restore from backup
cd /path/to/ai_center
git checkout HEAD~1 nginx/
sudo ./scripts/setup-nginx.sh
```

---

## Backup

### Backup Nginx Configuration

```bash
tar -czf nginx-backup-$(date +%Y%m%d).tar.gz \
    /etc/nginx/nginx.conf \
    /etc/nginx/conf.d/ai-center.conf \
    /etc/nginx/ssl/
```

### Restore Nginx Configuration

```bash
# Stop nginx
sudo systemctl stop nginx

# Restore files
tar -xzf nginx-backup-YYYYMMDD.tar.gz -C /

# Start nginx
sudo systemctl start nginx
```

### Backup Database

```bash
# Staging
docker compose -f docker-compose.staging.yml exec postgres pg_dump -U postgres ai_chatbot_staging > staging-backup-$(date +%Y%m%d).sql

# Production
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres ai_chatbot_prod > prod-backup-$(date +%Y%m%d).sql
```

---

## File Structure

```
ai_center/
├── nginx/
│   ├── nginx.conf              # Main nginx configuration
│   ├── ai-center.conf          # Virtual hosts (prod + staging)
│   └── README.md               # Nginx-specific documentation
├── scripts/
│   └── setup-nginx.sh          # One-time nginx setup script
├── docker-compose.staging.yml  # Staging environment
├── docker-compose.prod.yml     # Production environment
├── .gitlab-ci.yml              # CI/CD pipeline
└── docs/
    └── DEPLOYMENT.md           # This file
```
