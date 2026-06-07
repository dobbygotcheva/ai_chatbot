#!/bin/bash
# Bump code-exec-svc version

set -e

if [ -z "$1" ]; then
  echo "Usage: bump-code-exec-version.sh <patch|minor|major>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/bump-code-exec-version.sh patch   # 1.0.0 → 1.0.1"
  echo "  ./scripts/bump-code-exec-version.sh minor   # 1.0.0 → 1.1.0"
  echo "  ./scripts/bump-code-exec-version.sh major   # 1.0.0 → 2.0.0"
  exit 1
fi

cd "$(dirname "$0")/.."

pnpm version "$1" -C code-exec-svc

echo "✅ Bumped code-exec-svc version to $(node -p "require('./code-exec-svc/package.json').version")"
echo ""
echo "Don't forget to commit the change:"
echo "  git add code-exec-svc/package.json"
echo "  git commit -m 'chore(code-exec-svc): bump version to $(node -p "require('./code-exec-svc/package.json').version")'"
