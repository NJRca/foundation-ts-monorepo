#!/bin/bash

# Foundation Monorepo - Database Migration Testing
# End-to-end test of the migration system

set -e

echo "🧪 Foundation Monorepo - Database Migration Testing"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🐳 Starting PostgreSQL for testing..."
docker-compose up -d postgres

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking database health..."
if docker-compose exec postgres pg_isready -U foundation_user -d foundation_db > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL is not ready${NC}"
    exit 1
fi

echo ""
echo "📊 Checking initial migration status..."
npm run db:migrate:status

echo ""
echo "🗄️ Running database migrations..."
npm run db:migrate

echo ""
echo "📊 Checking post-migration status..."
npm run db:migrate:status

echo ""
echo "🔄 Testing idempotency (running migrations again)..."
npm run db:migrate

echo ""
echo "🔍 Verifying database schema..."
echo "Checking for users table..."
docker-compose exec postgres psql -U foundation_user -d foundation_db -c "\dt users" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Users table exists${NC}"
else
    echo -e "${RED}❌ Users table missing${NC}"
fi

echo ""
echo "Checking for seed users..."
user_count=$(docker-compose exec postgres psql -U foundation_user -d foundation_db -t -c "SELECT COUNT(*) FROM users;" | tr -d ' \n')
if [ "$user_count" -ge "2" ]; then
    echo -e "${GREEN}✅ Seed users found ($user_count users)${NC}"

    # Show seed users
    echo "📋 Seed users:"
    docker-compose exec postgres psql -U foundation_user -d foundation_db -c "SELECT email, name, roles FROM users;"
else
    echo -e "${RED}❌ Seed users missing (found $user_count users)${NC}"
fi

echo ""
echo "🔍 Checking migrations table..."
docker-compose exec postgres psql -U foundation_user -d foundation_db -c "SELECT version, name, executed_at FROM schema_migrations ORDER BY version;"

echo ""
echo -e "${GREEN}🎉 Database migration testing complete!${NC}"

echo ""
echo "💡 You can now test authentication with:"
echo "   curl -X POST http://localhost:3001/api/v1/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"admin@foundation.local\",\"password\":\"admin123\"}'"
