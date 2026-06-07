#!/bin/bash

URL="http://localhost:8002/mcp"
HEADERS="-H \"Content-Type: application/json\" -H \"Accept: application/json, text/event-stream\""

echo "=== Step 1: Initialize ==="
INIT_RESPONSE=$(curl -s -i -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}')

echo "$INIT_RESPONSE"

# Extract session ID from headers
SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "Mcp-Session-Id:" | cut -d: -f2 | tr -d ' \r\n')
echo ""
echo "Session ID: $SESSION_ID"

if [ -z "$SESSION_ID" ]; then
  echo "ERROR: No session ID received. Check if the server is running correctly."
  exit 1
fi

echo ""
echo "=== Step 2: Send Initialized Notification ==="
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

echo ""
echo ""
echo "=== Step 3: Call confluence_get_page ==="
# TODO: Replace YOUR_PERSONAL_ACCESS_TOKEN with your actual Confluence Personal Access Token
curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "X-Atlassian-Confluence-Url: https://confluence.egt.com/" \
  -H "X-Atlassian-Confluence-Personal-Token: MjIyMzI4ODE2MDgxOldHzsg1zXDeQXI08v7VwFzduJvU" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"confluence_get_page","arguments":{"page_id":"461697094"}}}'

echo ""
