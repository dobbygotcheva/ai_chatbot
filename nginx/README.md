# Nginx Configuration

See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for complete deployment instructions.

## Quick Reference

| Domain | Backend | Environment |
|--------|---------|-------------|
| `ai-center.egt.com` | `localhost:3000` | Production |
| `ai-center-test.egt.com` | `localhost:3001` | Staging |

## Setup

```bash
# One-time setup (from repository root)
sudo ./scripts/setup-nginx.sh
```

## Files

- `nginx.conf` - Main nginx configuration
- `ai-center.conf` - Virtual hosts for both domains

## Updating Configuration

```bash
# After modifying nginx config files
git pull
sudo ./scripts/setup-nginx.sh
```

This will copy the updated files and reload nginx automatically.
