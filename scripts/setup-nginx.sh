#!/bin/bash
set -e

echo "🚀 AI Center - Nginx One-Time Setup"
echo "===================================="
echo

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Error: This script must be run as root or with sudo"
    echo "   Usage: sudo ./scripts/setup-nginx.sh"
    exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "⚠️  Nginx is not installed. Installing..."
    apt-get update
    apt-get install -y nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx already installed"
fi

# Create SSL directory
SSL_DIR="/etc/nginx/ssl"
if [ ! -d "$SSL_DIR" ]; then
    mkdir -p "$SSL_DIR"
    chmod 700 "$SSL_DIR"
    chown root:root "$SSL_DIR"
    echo "✅ Created $SSL_DIR"
else
    echo "✅ SSL directory already exists"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Copy nginx config
echo
echo "Copying nginx configuration..."
cp "$SCRIPT_DIR/nginx/nginx.conf" /etc/nginx/nginx.conf
echo "✅ Copied nginx.conf"

# Copy ai-center config
cp "$SCRIPT_DIR/nginx/ai-center.conf" /etc/nginx/conf.d/ai-center.conf
echo "✅ Copied ai-center.conf"

# Check for certificate files
echo
echo "Checking for certificate files..."
CERT_FILES=("egt.com-bundle.crt" "egt.com.key" "egt.com.crt")
MISSING_FILES=()

for file in "${CERT_FILES[@]}"; do
    if [ -f "$SSL_DIR/$file" ]; then
        echo "  ✅ $file found"
    else
        echo "  ❌ $file missing"
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo
    echo "⚠️  Missing certificate files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo
    echo "Upload certificate files to $SSL_DIR:"
    echo "  scp egt.com-bundle.crt egt.com.key egt.com.crt user@server:/tmp/"
    echo "  sudo mv /tmp/egt.com* $SSL_DIR/"
    echo
    echo "Then run this script again."
    exit 1
fi

# Set certificate permissions
echo
echo "Setting certificate permissions..."
chmod 600 "$SSL_DIR/egt.com.key"
chmod 644 "$SSL_DIR/egt.com-bundle.crt"
chmod 644 "$SSL_DIR/egt.com.crt"
echo "✅ Certificate permissions set"

# Test nginx configuration
echo
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Enable and start nginx
echo
echo "Enabling and starting nginx..."
systemctl enable nginx
systemctl restart nginx
echo "✅ Nginx started"

# Configure firewall
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    echo
    echo "Configuring firewall (ufw)..."
    ufw allow 'Nginx Full'
    echo "✅ Firewall configured"
else
    echo
    echo "ℹ️  UFW firewall not active - skipping firewall configuration"
fi

echo
echo "======================================"
echo "✅ Nginx setup complete!"
echo
echo "Domains configured:"
echo "  - https://ai-center.egt.com → localhost:3000 (production)"
echo "  - https://ai-center-test.egt.com → localhost:3001 (staging)"
echo
echo "Next steps:"
echo "1. Ensure your applications are running on ports 3000 and 3001"
echo "2. Test the domains:"
echo "   curl -I https://ai-center.egt.com"
echo "   curl -I https://ai-center-test.egt.com"
echo
echo "To update nginx config in the future:"
echo "  1. Update files in repo"
echo "  2. Run: sudo ./scripts/setup-nginx.sh"
echo "  3. Nginx will reload automatically"
echo
