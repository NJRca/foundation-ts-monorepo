#!/bin/bash

echo "=== Testing Observability Middleware ==="
echo ""

# Navigate to user-service directory
cd /Users/neilreiher/Library/CloudStorage/OneDrive-Personal/Documents/GitHub/foundation-ts-monorepo/services/user-service

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsc src/server-observability.ts --outDir ./temp --target es2022 --module commonjs --esModuleInterop --skipLibCheck

# Start server in background
echo "Starting observability server on port 3003..."
PORT=3003 node ./temp/server-observability.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

echo ""
echo "=== Testing Health Endpoint ==="
echo "Request: GET /health"
echo "Response:"
curl -s http://localhost:3003/health | jq .

echo ""
echo ""
echo "=== Testing Metrics Endpoint ==="
echo "Request: GET /metrics"
echo "Response:"
curl -s http://localhost:3003/metrics

echo ""
echo ""
echo "=== Testing Login Endpoint ==="
echo "Request: POST /api/v1/auth/login"
echo "Response:"
curl -s -X POST http://localhost:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foundation.local","password":"admin123"}' | jq .

echo ""
echo ""
echo "=== Testing Users Endpoint ==="
echo "Request: GET /api/v1/users"
echo "Response:"
curl -s http://localhost:3003/api/v1/users | jq .

echo ""
echo ""
echo "=== Testing 404 Endpoint ==="
echo "Request: GET /nonexistent"
echo "Response:"
curl -s http://localhost:3003/nonexistent | jq .

echo ""
echo ""
echo "=== Stopping Server ==="
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo ""
echo "=== Observability Test Complete ==="
echo "Check the server logs above to see:"
echo "- Correlation IDs in every request/response"
echo "- Structured JSON logging"
echo "- Request/response timing"
echo "- Error handling with observability context"
echo "- Metrics endpoint providing Prometheus format"
