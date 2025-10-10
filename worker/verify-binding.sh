#!/bin/bash

# Script to verify server binding
echo "🔍 Checking server binding..."

# Check if server is running on port 3000
echo "📡 Checking HTTP server (port 3000):"
if command -v ss &> /dev/null; then
    ss -tlnp | grep :3000 || echo "❌ No process listening on port 3000"
else
    netstat -tlnp | grep :3000 || echo "❌ No process listening on port 3000"
fi

# Check if WebSocket server is running on port 8080
echo "🔌 Checking WebSocket server (port 8080):"
if command -v ss &> /dev/null; then
    ss -tlnp | grep :8080 || echo "❌ No process listening on port 8080"
else
    netstat -tlnp | grep :8080 || echo "❌ No process listening on port 8080"
fi

# Test HTTP endpoint
echo "🌐 Testing HTTP endpoint:"
curl -s http://0.0.0.0:3000/health | jq . || echo "❌ HTTP endpoint not accessible"

echo "✅ Verification complete!"
