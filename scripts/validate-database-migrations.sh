#!/bin/bash

# Foundation Monorepo - Database Migration Validation
# Gap #6: Database migrations with versioning and dev-setup integration

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Database Migration Validation"
echo "===================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

components_ready=0
total_components=8

echo ""
echo "1. MIGRATION STRUCTURE VALIDATION:"
echo "=================================="

# Check migrations directory
if [ -d "sql/migrations" ]; then
    echo "  ✅ sql/migrations directory exists"
    components_ready=$((components_ready + 1))

    # Check for migration files
    migration_count=$(find sql/migrations -name "*.sql" -type f | wc -l | tr -d ' ')
    if [ "$migration_count" -gt 0 ]; then
        echo "    ✅ Found $migration_count migration files"

        # List migration files
        echo "    📋 Migration files:"
        find sql/migrations -name "*.sql" -type f | sort | while read file; do
            basename=$(basename "$file")
            echo "       - $basename"
        done
    else
        echo "    ❌ No migration files found in sql/migrations"
    fi
else
    echo "  ❌ sql/migrations directory missing"
fi

echo ""
echo "2. MIGRATION RUNNER VALIDATION:"
echo "==============================="

# Check migration runner script
if [ -f "sql/migrate.js" ]; then
    echo "  ✅ sql/migrate.js migration runner exists"
    components_ready=$((components_ready + 1))

    # Check if executable
    if [ -x "sql/migrate.js" ]; then
        echo "    ✅ Migration runner is executable"
    else
        echo "    ⚠️  Migration runner not executable (chmod +x sql/migrate.js)"
    fi

    # Check for Node.js dependencies (pg)
    if grep -q '"pg"' package.json; then
        echo "    ✅ PostgreSQL client (pg) dependency available"
    else
        echo "    ❌ PostgreSQL client (pg) dependency missing from package.json"
    fi
else
    echo "  ❌ sql/migrate.js migration runner missing"
fi

echo ""
echo "3. PACKAGE.JSON MIGRATION SCRIPTS:"
echo "=================================="

# Check for db:migrate script
if grep -q '"db:migrate"' package.json; then
    echo "  ✅ db:migrate script defined in package.json"
    components_ready=$((components_ready + 1))

    # Show the script
    migrate_script=$(grep '"db:migrate"' package.json | sed 's/.*"db:migrate": *"\([^"]*\)".*/\1/')
    echo "    📋 Script: $migrate_script"
else
    echo "  ❌ db:migrate script missing from package.json"
fi

# Check for db:migrate:status script
if grep -q '"db:migrate:status"' package.json; then
    echo "  ✅ db:migrate:status script defined in package.json"
    components_ready=$((components_ready + 1))
else
    echo "  ❌ db:migrate:status script missing from package.json"
fi

echo ""
echo "4. DEV-SETUP INTEGRATION:"
echo "========================="

# Check if dev-setup calls db:migrate
if [ -f "scripts/dev-setup.sh" ]; then
    if grep -q "db:migrate" scripts/dev-setup.sh; then
        echo "  ✅ dev-setup.sh includes database migration step"
        components_ready=$((components_ready + 1))
    else
        echo "  ❌ dev-setup.sh does not include database migration step"
    fi
else
    echo "  ❌ scripts/dev-setup.sh not found"
fi

echo ""
echo "5. DOCKER COMPOSE INTEGRATION:"
echo "=============================="

# Check Docker Compose postgres service
if [ -f "docker-compose.yml" ]; then
    if grep -q "postgres:" docker-compose.yml; then
        echo "  ✅ PostgreSQL service defined in docker-compose.yml"

        # Check if init.sql is still mounted (backwards compatibility)
        if grep -q "init.sql" docker-compose.yml; then
            echo "    ✅ init.sql mounted for backwards compatibility"
        else
            echo "    ⚠️  init.sql not mounted (migration-only approach)"
        fi

        components_ready=$((components_ready + 1))
    else
        echo "  ❌ PostgreSQL service missing from docker-compose.yml"
    fi
else
    echo "  ❌ docker-compose.yml not found"
fi

echo ""
echo "6. MIGRATION RUNNER FUNCTIONALITY:"
echo "================================="

# Check if migration runner can show help
if [ -f "sql/migrate.js" ]; then
    if node sql/migrate.js --help > /dev/null 2>&1; then
        echo "  ✅ Migration runner help works"
        components_ready=$((components_ready + 1))
    else
        echo "  ❌ Migration runner help fails"
        echo "    💡 Try: node sql/migrate.js --help"
    fi
else
    echo "  ❌ Migration runner not available"
fi

echo ""
echo "7. MIGRATION CONTENT VALIDATION:"
echo "==============================="

# Check if migration files have proper content
has_schema_migration=false
has_seed_migration=false

if [ -d "sql/migrations" ]; then
    # Check for schema migration
    if find sql/migrations -name "*schema*" -o -name "001_*" | grep -q .; then
        echo "  ✅ Initial schema migration found"
        has_schema_migration=true
    fi

    # Check for seed data migration
    if find sql/migrations -name "*seed*" -o -name "002_*" | grep -q .; then
        echo "  ✅ Seed data migration found"
        has_seed_migration=true
    fi

    if [ "$has_schema_migration" = true ] && [ "$has_seed_migration" = true ]; then
        echo "  ✅ Core migrations (schema + seed data) available"
        components_ready=$((components_ready + 1))
    else
        echo "  ❌ Missing core migrations (schema and/or seed data)"
    fi
else
    echo "  ❌ Cannot validate migration content - migrations directory missing"
fi

echo ""
echo "📊 MIGRATION SYSTEM SUMMARY:"
echo "============================"

if [ $components_ready -eq $total_components ]; then
    echo -e "${GREEN}✅ ALL MIGRATION COMPONENTS READY ($components_ready/$total_components)${NC}"
    echo ""
    echo -e "${GREEN}🎉 DATABASE MIGRATIONS FULLY OPERATIONAL!${NC}"
    echo ""
    echo "Migration system features:"
    echo "  ✅ Versioned migration files in sql/migrations/"
    echo "  ✅ Node.js migration runner with state tracking"
    echo "  ✅ pnpm run db:migrate command available"
    echo "  ✅ Integration with dev-setup for first-time initialization"
    echo "  ✅ Docker Compose compatibility maintained"
    echo "  ✅ Migration status checking (pnpm run db:migrate:status)"
    echo "  ✅ Proper schema and seed data separation"
    echo ""
    echo "Usage examples:"
    echo "  pnpm run db:migrate         # Run pending migrations"
    echo "  pnpm run db:migrate:status  # Check migration status"
    echo "  ./scripts/dev-setup.sh      # Full setup with migrations"
    echo ""
else
    echo -e "${RED}❌ MIGRATION ISSUES FOUND ($components_ready/$total_components ready)${NC}"
    echo ""
    missing=$((total_components - components_ready))
    echo "⚠️  $missing component(s) need attention before full migration readiness"
    echo ""
    echo "💡 Common fixes:"
    echo "  - Ensure sql/migrations directory exists with .sql files"
    echo "  - Check sql/migrate.js is present and executable"
    echo "  - Verify package.json has db:migrate scripts"
    echo "  - Update scripts/dev-setup.sh to call pnpm run db:migrate"
fi
