#!/bin/bash

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Workspace & Scripts Validation"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Test result functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ️  INFO${NC}: $1"
}

# Helper function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Helper function to check if script exists and is executable
script_exists() {
    if [[ -f "$1" && -x "$1" ]]; then
        return 0
    else
        return 1
    fi
}

# Helper function to check npm script exists
npm_script_exists() {
    npm run --silent 2>/dev/null | grep -q "^  $1$" || npm run | grep -q "^  $1$" 2>/dev/null
}

echo ""
echo "📋 1. CHECKING WORKSPACE CONFIGURATION"
echo "-------------------------------------"

# Check pnpm-workspace.yaml
if [[ -f "pnpm-workspace.yaml" ]]; then
    pass "pnpm-workspace.yaml exists"

    # Check workspace patterns (simplified)
    if cat pnpm-workspace.yaml | grep -F "packages/*" >/dev/null 2>&1; then
        pass "packages/* pattern included in workspace"
    else
        fail "packages/* pattern missing from workspace"
    fi

    if cat pnpm-workspace.yaml | grep -F "services/*" >/dev/null 2>&1; then
        pass "services/* pattern included in workspace"
    else
        fail "services/* pattern missing from workspace"
    fi

    # Note: tests/, scripts/, docs/, examples/ should NOT be in pnpm-workspace
    # as they are utility directories, not npm packages
    info "tests/, scripts/, docs/, examples/ correctly excluded from workspace (not npm packages)"

else
    fail "pnpm-workspace.yaml not found"
fi

# Verify actual workspace discovery
if npm run workspace:list >/dev/null 2>&1; then
    pass "npm workspace discovery works"
    WORKSPACE_COUNT=$(npm ls --workspaces --depth=0 2>/dev/null | grep "-> ./" | wc -l)
    info "Found $WORKSPACE_COUNT workspaces"
else
    fail "npm workspace discovery failed"
fi

echo ""
echo "📦 2. CHECKING PACKAGE STRUCTURE"
echo "-------------------------------"

# Check expected packages exist
EXPECTED_PACKAGES=(
    "packages/analyzer"
    "packages/api-gateway"
    "packages/app"
    "packages/config"
    "packages/contracts"
    "packages/database"
    "packages/domain-sample"
    "packages/events"
    "packages/observability"
    "packages/performance"
    "packages/security"
    "packages/selfheal-llm"
    "packages/utils"
)

for pkg in "${EXPECTED_PACKAGES[@]}"; do
    if [[ -d "$pkg" && -f "$pkg/package.json" ]]; then
        pass "Package exists: $pkg"
    else
        fail "Package missing or invalid: $pkg"
    fi
done

# Check expected services exist
EXPECTED_SERVICES=(
    "services/user-service"
)

for svc in "${EXPECTED_SERVICES[@]}"; do
    if [[ -d "$svc" && -f "$svc/package.json" ]]; then
        pass "Service exists: $svc"
    else
        fail "Service missing or invalid: $svc"
    fi
done

echo ""
echo "🛠️  3. CHECKING DEVELOPMENT SCRIPTS"
echo "-----------------------------------"

# Check critical scripts exist in package.json
CRITICAL_SCRIPTS=(
    "build"
    "test"
    "lint"
    "clean"
    "dev:setup"
    "dev:start"
    "dev:stop"
    "dev:full"
    "check:health"
    "workspace:list"
)

for script in "${CRITICAL_SCRIPTS[@]}"; do
    if npm_script_exists "$script"; then
        pass "Script exists: $script"
    else
        fail "Script missing: $script"
    fi
done

# Check supporting script files exist
if script_exists "scripts/dev-setup.sh"; then
    pass "dev-setup.sh script exists and is executable"
else
    fail "dev-setup.sh script missing or not executable"
fi

if script_exists "scripts/dev-utils.sh"; then
    pass "dev-utils.sh script exists and is executable"
else
    warn "dev-utils.sh script missing or not executable"
fi

echo ""
echo "🐳 4. CHECKING DOCKER CONFIGURATION"
echo "----------------------------------"

# Check docker-compose.yml
if [[ -f "docker-compose.yml" ]]; then
    pass "docker-compose.yml exists"

    # Check for full-stack profile
    if grep -q "full-stack" docker-compose.yml; then
        pass "full-stack profile found in docker-compose.yml"
    else
        fail "full-stack profile missing from docker-compose.yml"
    fi

    # Check for essential services
    ESSENTIAL_SERVICES=("postgres" "redis" "prometheus" "grafana")
    for service in "${ESSENTIAL_SERVICES[@]}"; do
        if grep -q "^  $service:" docker-compose.yml; then
            pass "Docker service defined: $service"
        else
            fail "Docker service missing: $service"
        fi
    done

else
    fail "docker-compose.yml not found"
fi

echo ""
echo "📚 5. CHECKING DOCUMENTATION ALIGNMENT"
echo "-------------------------------------"

# Check README mentions the right scripts
if [[ -f "README.md" ]]; then
    pass "README.md exists"

    README_SCRIPTS=("dev:setup" "dev:start" "check:health" "dev:full")
    for script in "${README_SCRIPTS[@]}"; do
        if grep -q "$script" README.md; then
            pass "README documents script: $script"
        else
            warn "README missing script documentation: $script"
        fi
    done
else
    fail "README.md not found"
fi

echo ""
echo "🔧 6. TESTING SCRIPT FUNCTIONALITY"
echo "---------------------------------"

# Test workspace listing (safe to run)
if npm run workspace:list >/dev/null 2>&1; then
    pass "workspace:list script works"
else
    fail "workspace:list script broken"
fi

# Test build (safe to run, already done)
if npm run build >/dev/null 2>&1; then
    pass "build script works"
else
    fail "build script broken"
fi

# Check if dev-setup script can at least parse (don't run it fully)
if bash -n scripts/dev-setup.sh 2>/dev/null; then
    pass "dev-setup.sh script syntax valid"
else
    fail "dev-setup.sh script has syntax errors"
fi

echo ""
echo "📊 7. VALIDATION SUMMARY"
echo "========================"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "Results:"
echo -e "  ${GREEN}✅ Passed: $PASSED${NC}"
echo -e "  ${RED}❌ Failed: $FAILED${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo -e "  📝 Total: $TOTAL"

echo ""
if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 WORKSPACE & SCRIPTS VALIDATION PASSED!${NC}"
    echo "All critical workspace patterns and scripts are properly configured."
    echo ""
    echo "✅ Workspace validation complete!"
    exit 0
else
    echo -e "${RED}💥 WORKSPACE & SCRIPTS VALIDATION FAILED!${NC}"
    echo "Found $FAILED critical issues that need to be resolved."
    echo ""
    echo "🔧 Recommended fixes:"
    echo "  1. Ensure all packages have valid package.json files"
    echo "  2. Add missing scripts to root package.json"
    echo "  3. Make script files executable: chmod +x scripts/*.sh"
    echo "  4. Verify docker-compose.yml has required services and profiles"
    exit 1
fi
