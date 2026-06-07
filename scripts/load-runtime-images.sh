#!/bin/sh
# Load runtime images into Docker-in-Docker daemon

set -e

DIND_CONTAINER="ai_center_code_exec_dind"

echo "⏳ Waiting for Docker-in-Docker to be ready..."
i=1
while [ $i -le 30 ]; do
  if docker exec "$DIND_CONTAINER" docker info > /dev/null 2>&1; then
    echo "✅ Docker-in-Docker is ready"
    break
  fi
  echo "  Attempt $i/30 - waiting for dind..."
  i=$((i + 1))
  sleep 2
done

echo "📦 Loading runtime images into Docker-in-Docker..."
for image in code-exec-python:latest code-exec-node:latest code-exec-bash:latest; do
  echo "  Loading $image..."
  if docker image inspect "$image" > /dev/null 2>&1; then
    docker save "$image" | docker exec -i "$DIND_CONTAINER" docker load
    echo "    ✅ Loaded $image"
  else
    echo "    ⚠️  Image $image not found on host, skipping..."
  fi
done

echo "✅ All runtime images loaded into Docker-in-Docker"
