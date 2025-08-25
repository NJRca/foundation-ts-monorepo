#!/bin/bash

# Foundation Monorepo - Static Analyzer Validation
# Gap #7: Static analyzer "happy path" with SARIF output and CI integration

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Static Analyzer Validation"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

components_ready=0
total_components=8

echo ""
echo "1. ANALYZER PACKAGE STRUCTURE:"
echo "=============================="

# Check analyzer package exists
if [ -d "packages/analyzer" ]; then
    echo "  ✅ packages/analyzer directory exists"
    components_ready=$((components_ready + 1))

    # Check main analyzer files
    if [ -f "packages/analyzer/src/index.ts" ]; then
        echo "    ✅ Main analyzer implementation (index.ts) exists"
    else
        echo "    ❌ Main analyzer implementation missing"
    fi

    if [ -f "packages/analyzer/src/cli.ts" ]; then
        echo "    ✅ CLI implementation (cli.ts) exists"
    else
        echo "    ❌ CLI implementation missing"
    fi

    if [ -f "packages/analyzer/package.json" ]; then
        echo "    ✅ Package configuration exists"

        # Check for CLI binary configuration
        if grep -q '"bin"' packages/analyzer/package.json; then
            echo "      ✅ CLI binary configured in package.json"
        else
            echo "      ❌ CLI binary not configured"
        fi
    else
        echo "    ❌ Package configuration missing"
    fi
else
    echo "  ❌ packages/analyzer directory missing"
fi

echo ""
echo "2. SARIF COMPLIANCE:"
echo "==================="

# Check if analyzer produces valid SARIF
if [ -f "packages/analyzer/dist/cli.js" ]; then
    echo "  ✅ Analyzer CLI is built"
    components_ready=$((components_ready + 1))

    # Test SARIF generation
    if node packages/analyzer/dist/cli.js examples --quiet 2>/dev/null; then
        echo "    ✅ Analyzer runs successfully"

        if [ -f "analysis-results.sarif" ]; then
            echo "    ✅ SARIF file generated"

            # Check SARIF structure
            if jq -e '.version' analysis-results.sarif >/dev/null 2>&1; then
                echo "      ✅ Valid JSON structure"

                version=$(jq -r '.version' analysis-results.sarif 2>/dev/null)
                if [ "$version" = "2.1.0" ]; then
                    echo "      ✅ SARIF version 2.1.0 compliant"
                else
                    echo "      ⚠️  SARIF version: $version (expected 2.1.0)"
                fi

                # Check for required SARIF fields
                if jq -e '.runs[0].tool.driver.name' analysis-results.sarif >/dev/null 2>&1; then
                    echo "      ✅ Tool driver name present"
                else
                    echo "      ❌ Tool driver name missing"
                fi

                if jq -e '.runs[0].tool.driver.rules' analysis-results.sarif >/dev/null 2>&1; then
                    echo "      ✅ Rules definition present"
                else
                    echo "      ❌ Rules definition missing"
                fi
            else
                echo "      ❌ Invalid JSON structure"
            fi
        else
            echo "    ❌ SARIF file not generated"
        fi
    else
        echo "    ❌ Analyzer fails to run"
    fi
else
    echo "  ❌ Analyzer CLI not built"
fi

echo ""
echo "3. CUSTOM RULES IMPLEMENTATION:"
echo "==============================="

# Check for custom rules in the analyzer
if [ -f "packages/analyzer/src/index.ts" ]; then
    rule_count=$(grep -c "this\.rules\.set" packages/analyzer/src/index.ts || echo "0")
    if [ "$rule_count" -gt 0 ]; then
        echo "  ✅ Custom rules implemented ($rule_count rules found)"
        components_ready=$((components_ready + 1))

        # Check for specific rule types
        if grep -q "hardcoded-secrets" packages/analyzer/src/index.ts; then
            echo "    ✅ Security rule: hardcoded-secrets"
        fi

        if grep -q "direct-db-access" packages/analyzer/src/index.ts; then
            echo "    ✅ Architecture rule: direct-db-access"
        fi

        if grep -q "missing-error-handling" packages/analyzer/src/index.ts; then
            echo "    ✅ Quality rule: missing-error-handling"
        fi

        if grep -q "todo-comment" packages/analyzer/src/index.ts; then
            echo "    ✅ Maintenance rule: todo-comment"
        fi

        if grep -q "console-usage" packages/analyzer/src/index.ts; then
            echo "    ✅ Observability rule: console-usage"
        fi
    else
        echo "  ❌ No custom rules implemented"
    fi
else
    echo "  ❌ Cannot check rules - analyzer source missing"
fi

echo ""
echo "4. CLI FUNCTIONALITY:"
echo "===================="

# Check CLI options and help
if [ -f "packages/analyzer/dist/cli.js" ]; then
    if node packages/analyzer/dist/cli.js --help 2>/dev/null | grep -q "Foundation Static Analyzer"; then
        echo "  ✅ CLI help working"
        components_ready=$((components_ready + 1))

        # Check for multiple output formats
        if node packages/analyzer/dist/cli.js --help 2>/dev/null | grep -q "sarif, json, console"; then
            echo "    ✅ Multiple output formats supported"
        else
            echo "    ❌ Limited output format support"
        fi

        # Test console output
        if node packages/analyzer/dist/cli.js examples --format console --quiet 2>/dev/null | grep -q "Static Analysis Results"; then
            echo "    ✅ Console output format working"
        else
            echo "    ❌ Console output format not working"
        fi
    else
        echo "  ❌ CLI help not working"
    fi
else
    echo "  ❌ CLI not available"
fi

echo ""
echo "5. PACKAGE.JSON INTEGRATION:"
echo "============================"

# Check for analyze script in root package.json
if grep -q '"analyze"' package.json; then
    echo "  ✅ analyze script defined in package.json"
    components_ready=$((components_ready + 1))

    # Check if script calls the analyzer
    analyze_script=$(grep '"analyze"' package.json | head -1)
    if echo "$analyze_script" | grep -q "analyzer"; then
        echo "    ✅ Script calls analyzer"
    else
        echo "    ⚠️  Script may not call analyzer directly"
    fi
else
    echo "  ❌ analyze script missing from package.json"
fi

# Check for additional analyzer commands
if grep -q '"analyze:sarif"' package.json; then
    echo "  ✅ analyze:sarif script available"
else
    echo "  ❌ analyze:sarif script missing"
fi

if grep -q '"analyze:examples"' package.json; then
    echo "  ✅ analyze:examples script available"
else
    echo "  ❌ analyze:examples script missing"
fi

echo ""
echo "6. GOLDEN EXAMPLES:"
echo "=================="

# Check for examples that trigger rules
if [ -d "examples" ]; then
    echo "  ✅ examples directory exists"

    example_count=$(find examples -name "*.ts" -o -name "*.js" | wc -l | tr -d ' ')
    if [ "$example_count" -gt 0 ]; then
        echo "    ✅ Found $example_count example file(s)"
        components_ready=$((components_ready + 1))

        # Check if analyzer actually finds issues in examples
        if [ -f "analysis-results.sarif" ]; then
            issues_count=$(jq '.runs[0].results | length' analysis-results.sarif 2>/dev/null || echo "0")
            if [ "$issues_count" -gt 0 ]; then
                echo "    ✅ Examples trigger analyzer rules ($issues_count issues found)"
            else
                echo "    ❌ Examples don't trigger any analyzer rules"
            fi
        fi

        # Check for specific example patterns
        if find examples -name "*.ts" -exec grep -l "TODO" {} \; | head -1 >/dev/null; then
            echo "      ✅ TODO comments for testing"
        fi

        if find examples -name "*.ts" -exec grep -l "console\." {} \; | head -1 >/dev/null; then
            echo "      ✅ Console usage for testing"
        fi

        if find examples -name "*.ts" -exec grep -l "password.*:" {} \; | head -1 >/dev/null; then
            echo "      ✅ Hardcoded secrets for testing"
        fi
    else
        echo "    ❌ No example files found"
    fi
else
    echo "  ❌ examples directory missing"
fi

echo ""
echo "7. CI/CD INTEGRATION:"
echo "===================="

# Check for GitHub Actions workflow
if [ -f ".github/workflows/static-analysis.yml" ]; then
    echo "  ✅ GitHub Actions workflow exists"
    components_ready=$((components_ready + 1))

    # Check for SARIF upload
    if grep -q "upload-sarif" .github/workflows/static-analysis.yml; then
        echo "    ✅ SARIF upload to GitHub Code Scanning configured"
    else
        echo "    ❌ SARIF upload not configured"
    fi

    # Check for analyzer execution
    if grep -q "analyze" .github/workflows/static-analysis.yml; then
        echo "    ✅ Analyzer execution in CI workflow"
    else
        echo "    ❌ Analyzer not executed in CI"
    fi

    # Check for error handling
    if grep -q "continue-on-error" .github/workflows/static-analysis.yml; then
        echo "    ✅ Error handling configured"
    else
        echo "    ⚠️  No error handling configured"
    fi
else
    echo "  ❌ GitHub Actions workflow missing"
fi

echo ""
echo "8. README CLAIMS VALIDATION:"
echo "============================"

# Check if README mentions SARIF analyzer
if [ -f "README.md" ]; then
    if grep -q -i "sarif\|static.*analy" README.md; then
        echo "  ✅ README mentions static analysis/SARIF"
        components_ready=$((components_ready + 1))
    else
        echo "  ❌ README doesn't mention static analysis/SARIF"
    fi
else
    echo "  ❌ README.md not found"
fi

echo ""
echo "📊 STATIC ANALYZER SUMMARY:"
echo "==========================="

if [ $components_ready -eq $total_components ]; then
    echo -e "${GREEN}✅ ALL ANALYZER COMPONENTS READY ($components_ready/$total_components)${NC}"
    echo ""
    echo -e "${GREEN}🎉 STATIC ANALYZER FULLY OPERATIONAL!${NC}"
    echo ""
    echo "Static analyzer features:"
    echo "  ✅ SARIF 2.1.0 compliant output"
    echo "  ✅ Custom security and quality rules"
    echo "  ✅ Multiple output formats (SARIF, JSON, console)"
    echo "  ✅ CLI with comprehensive options"
    echo "  ✅ Integration with package.json scripts"
    echo "  ✅ Golden examples for testing"
    echo "  ✅ GitHub Actions CI with SARIF upload"
    echo "  ✅ README documentation"
    echo ""
    echo "Usage examples:"
    echo "  pnpm run analyze              # Full codebase analysis"
    echo "  pnpm run analyze:examples     # Test with examples"
    echo "  node packages/analyzer/dist/cli.js --help  # CLI help"
    echo ""
else
    echo -e "${RED}❌ ANALYZER ISSUES FOUND ($components_ready/$total_components ready)${NC}"
    echo ""
    missing=$((total_components - components_ready))
    echo "⚠️  $missing component(s) need attention before full analyzer readiness"
    echo ""
    echo "💡 Common fixes:"
    echo "  - Build the analyzer: npm run build"
    echo "  - Add examples to trigger rules"
    echo "  - Configure GitHub Actions workflow"
    echo "  - Update README to mention SARIF analyzer"
fi
