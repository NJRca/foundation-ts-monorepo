#!/bin/bash

set -e

echo "🚀 Foundation TypeScript Monorepo Development Setup"
echo "=================================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is required but not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is required but not installed. Please install Docker Compose first."
    exit 1
fi

if ! command_exists pnpm; then
    echo "❌ pnpm is required but not installed. Please install pnpm first."
    echo "   npm install -g pnpm"
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ All prerequisites are installed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo ""
echo "🔨 Building packages..."
pnpm run build

# Start infrastructure services
echo ""
echo "🏗️ Starting infrastructure services (PostgreSQL, Redis, Prometheus, Grafana)..."
docker-compose up -d postgres redis prometheus grafana

# Wait for databases to be ready
echo ""
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Check if databases are healthy
echo "🔍 Checking database health..."
docker-compose exec postgres pg_isready -U foundation_user -d foundation_db
if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready. Check logs with: docker-compose logs postgres"
    exit 1
fi

docker-compose exec redis redis-cli ping
if [ $? -eq 0 ]; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready. Check logs with: docker-compose logs redis"
    exit 1
fi

# Start user service
echo ""
echo "🚀 Starting user service..."
docker-compose up -d user-service

# Wait for user service to be ready
echo "⏳ Waiting for user service to be ready..."
sleep 15

# Check if user service is healthy
echo "🔍 Checking user service health..."
curl -f http://localhost:3001/health || {
    echo "❌ User service is not ready. Check logs with: docker-compose logs user-service"
    exit 1
}

echo "✅ User service is ready"

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "Available services:"
echo "  📊 Grafana Dashboard: http://localhost:3000 (admin/admin)"
echo "  📈 Prometheus: http://localhost:9090"
echo "  👥 User Service: http://localhost:3001"
echo "  📋 User Service Health: http://localhost:3001/health"
echo "  📊 User Service Metrics: http://localhost:9464/metrics"
echo ""
echo "Database connections:"
echo "  🐘 PostgreSQL: localhost:5432 (foundation_user/foundation_password)"
echo "  🔴 Redis: localhost:6379"
echo ""
echo "Useful commands:"
echo "  📜 View logs: docker-compose logs [service-name]"
echo "  🔄 Restart service: docker-compose restart [service-name]"
echo "  🛑 Stop all: docker-compose down"
echo "  🧹 Clean up: docker-compose down -v (removes volumes)"
echo ""
echo "API Examples:"
echo "  curl -X POST http://localhost:3001/api/v1/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@foundation.local\",\"password\":\"admin123\"}'"
echo ""
echo "  curl http://localhost:3001/api/v1/users \\"
echo "    -H 'Authorization: Bearer <token>'"
