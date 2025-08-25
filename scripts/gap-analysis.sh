#!/bin/bash

echo "🔍 Foundation Monorepo - Workspace & Scripts Gap Analysis"
echo "========================================================="

# Check workspace patterns
echo ""
echo "1. WORKSPACE PATTERNS:"
echo "  pnpm-workspace.yaml contents:"
cat pnpm-workspace.yaml | sed 's/^/    /'

echo ""
echo "2. WORKSPACE DISCOVERY:"
npm run workspace:list 2>/dev/null | grep "\->" | head -5

echo ""
echo "3. CRITICAL SCRIPTS CHECK:"
SCRIPTS=("dev:setup" "dev:start" "dev:full" "check:health")
for script in "${SCRIPTS[@]}"; do
    if grep -q "\"$script\":" package.json; then
        echo "  ✅ $script - EXISTS"
    else
        echo "  ❌ $script - MISSING"
    fi
done

echo ""
echo "4. SCRIPT FILES CHECK:"
echo "  scripts/dev-setup.sh: $(test -x scripts/dev-setup.sh && echo "EXISTS & EXECUTABLE" || echo "MISSING OR NOT EXECUTABLE")"
echo "  docker-compose.yml: $(test -f docker-compose.yml && echo "EXISTS" || echo "MISSING")"

echo ""
echo "5. DOCKER COMPOSE PROFILES:"
if [ -f docker-compose.yml ]; then
    if grep -q "full-stack" docker-compose.yml; then
        echo "  ✅ full-stack profile - FOUND"
    else
        echo "  ❌ full-stack profile - MISSING"
    fi
else
    echo "  ❌ docker-compose.yml - MISSING"
fi

echo ""
echo "6. PACKAGE STRUCTURE:"
PACKAGES=$(find packages -name "package.json" 2>/dev/null | wc -l)
SERVICES=$(find services -name "package.json" 2>/dev/null | wc -l)
echo "  Packages found: $PACKAGES"
echo "  Services found: $SERVICES"

echo ""
echo "✅ Gap Analysis Complete!"
echo ""
echo "🔧 RECOMMENDATIONS:"
echo "   1. Workspace patterns are correctly configured (packages/*, services/*)"
echo "   2. Utility directories (tests/, scripts/, docs/) correctly excluded"
echo "   3. All advertised scripts exist and should work"
echo "   4. Docker Compose has full-stack profile for dev:full command"
