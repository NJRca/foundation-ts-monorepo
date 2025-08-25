#!/bin/bash

# Foundation Monorepo - Dependency Analysis Script
# Gap #2: Dependency Management & Version Consistency

set -e

echo "🔍 Foundation Monorepo - Dependency Analysis"
echo "============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "1. WORKSPACE DEPENDENCY VALIDATION:"

# Check if pnpm is properly managing the workspace
if [ -f "pnpm-lock.yaml" ]; then
    echo "  ✅ pnpm-lock.yaml exists - workspace locking active"
else
    echo "  ❌ pnpm-lock.yaml missing - dependency locking broken"
fi

# Check for conflicting lock files
echo ""
echo "2. LOCK FILE CONFLICTS:"
conflicting_locks=()
[ -f "package-lock.json" ] && conflicting_locks+=("package-lock.json")
[ -f "yarn.lock" ] && conflicting_locks+=("yarn.lock")

if [ ${#conflicting_locks[@]} -eq 0 ]; then
    echo "  ✅ No conflicting lock files"
else
    echo "  ❌ Conflicting lock files found: ${conflicting_locks[*]}"
fi

echo ""
echo "3. TYPESCRIPT VERSION CONSISTENCY:"

# Find all package.json files and check TypeScript versions
ts_versions=$(find packages services -name "package.json" -exec grep -l "typescript" {} \; | xargs grep "typescript" | grep -o '"[0-9][^"]*"' | sort | uniq)

echo "  TypeScript versions found:"
if [ -z "$ts_versions" ]; then
    echo "    ⚠️  No TypeScript dependencies found in packages"
else
    echo "$ts_versions" | while read -r version; do
        count=$(find packages services -name "package.json" -exec grep -l "typescript" {} \; | xargs grep "typescript" | grep -c "$version" || echo "0")
        echo "    - $version (used in $count packages)"
    done
fi

echo ""
echo "4. FOUNDATION PACKAGE CROSS-REFERENCES:"

# Check for @foundation/* dependencies
echo "  Internal @foundation package usage:"
foundation_deps=$(find packages services -name "package.json" -exec grep -l "@foundation/" {} \; | wc -l | tr -d ' ')
echo "    Packages with @foundation deps: $foundation_deps"

# List specific @foundation dependencies
echo "  Detailed @foundation dependency map:"
find packages services -name "package.json" -exec sh -c '
    pkg_name=$(basename $(dirname "$1"))
    deps=$(grep -o "@foundation/[^\"]*" "$1" 2>/dev/null | sort | uniq | tr "\n" " " || echo "none")
    echo "    $pkg_name -> $deps"
' _ {} \;

echo ""
echo "5. COMMON DEPENDENCY VERSION CONFLICTS:"

# Check for common packages that should have consistent versions
common_packages=("express" "jest" "eslint" "prettier" "dotenv")

for pkg in "${common_packages[@]}"; do
    versions=$(find packages services . -maxdepth 2 -name "package.json" -exec grep -l "\"$pkg\"" {} \; 2>/dev/null | xargs grep "\"$pkg\"" 2>/dev/null | grep -o '"[0-9][^"]*"' | sort | uniq || echo "")

    if [ -n "$versions" ]; then
        version_count=$(echo "$versions" | wc -l | tr -d ' ')
        if [ "$version_count" -gt 1 ]; then
            echo "  ⚠️  $pkg has $version_count different versions:"
            echo "$versions" | while read -r version; do
                echo "      - $version"
            done
        else
            echo "  ✅ $pkg version consistent: $versions"
        fi
    fi
done

echo ""
echo "6. PEER DEPENDENCY VALIDATION:"

# Check for unresolved peer dependencies
echo "  Checking for peer dependency warnings..."
if command -v pnpm >/dev/null 2>&1; then
    peer_warnings=$(pnpm list 2>&1 | grep -i "peer" | wc -l | tr -d ' ')
    if [ "$peer_warnings" -eq 0 ]; then
        echo "  ✅ No peer dependency warnings"
    else
        echo "  ⚠️  $peer_warnings peer dependency warnings found"
        echo "      Run 'pnpm list' to see details"
    fi
else
    echo "  ⚠️  pnpm not available for peer dependency check"
fi

echo ""
echo "7. WORKSPACE LINKING VALIDATION:"

# Check if packages can reference each other properly
echo "  Testing workspace linking..."
linking_issues=0

# Look for packages that should be linked but might not be
for pkg_dir in packages/*; do
    if [ -d "$pkg_dir" ]; then
        pkg_name=$(basename "$pkg_dir")
        # Check if this package is referenced by others using workspace: protocol
        workspace_refs=$(find packages services -name "package.json" -exec grep -l "@foundation/$pkg_name" {} \; 2>/dev/null | wc -l | tr -d ' ')
        if [ "$workspace_refs" -gt 0 ]; then
            echo "    @foundation/$pkg_name: $workspace_refs references"
        fi
    fi
done

echo ""
echo "✅ Dependency Analysis Complete!"

echo ""
echo "🔧 RECOMMENDATIONS:"
if [ ${#conflicting_locks[@]} -gt 0 ]; then
    echo "   1. Remove conflicting lock files: ${conflicting_locks[*]}"
fi
echo "   2. Run 'pnpm install' to ensure workspace linking"
echo "   3. Consider using exact versions for critical dependencies"
echo "   4. Review any peer dependency warnings"
echo "   5. Ensure @foundation packages use workspace: protocol for internal deps"
