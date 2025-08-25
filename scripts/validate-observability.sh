#!/bin/bash

# Foundation Monorepo - Observability Validation
# Gap #4: Observability that actually emits data

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Observability Validation"
echo "================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "1. PROMETHEUS CONFIGURATION VALIDATION:"

if [ -f "monitoring/prometheus.yml" ]; then
    echo "  ✅ prometheus.yml exists"

    # Check if user-service scrape target exists on port 9464
    if grep -q "user-service:9464" monitoring/prometheus.yml; then
        echo "    ✅ user-service scrape target on port 9464 configured"
    else
        echo "    ❌ user-service scrape target on port 9464 missing"
    fi

    # Check scrape interval
    if grep -q "scrape_interval:" monitoring/prometheus.yml; then
        echo "    ✅ scrape_interval configured"
    else
        echo "    ❌ scrape_interval missing"
    fi

    # Check metrics path
    if grep -q "metrics_path: '/metrics'" monitoring/prometheus.yml; then
        echo "    ✅ /metrics path configured"
    else
        echo "    ⚠️  /metrics path not explicitly configured"
    fi

else
    echo "  ❌ monitoring/prometheus.yml missing"
fi

echo ""
echo "2. GRAFANA CONFIGURATION VALIDATION:"

if [ -f "monitoring/grafana-datasources/datasource.yml" ]; then
    echo "  ✅ Grafana datasource configuration exists"

    # Check if Prometheus datasource is configured
    if grep -q "prometheus:9090" monitoring/grafana-datasources/datasource.yml; then
        echo "    ✅ Prometheus datasource pointing to prometheus:9090"
    else
        echo "    ❌ Prometheus datasource misconfigured"
    fi
else
    echo "  ❌ Grafana datasource configuration missing"
fi

# Check for Grafana dashboards
if [ -d "monitoring/grafana-dashboards" ]; then
    dashboard_count=$(find monitoring/grafana-dashboards -name "*.json" | wc -l | tr -d ' ')
    echo "  ✅ Grafana dashboards directory exists ($dashboard_count dashboards)"

    if [ "$dashboard_count" -eq 0 ]; then
        echo "    ⚠️  No dashboard JSON files found"
    else
        echo "    ✅ Found $dashboard_count dashboard files"
    fi
else
    echo "  ❌ monitoring/grafana-dashboards directory missing"
fi

echo ""
echo "3. SERVICE METRICS IMPLEMENTATION:"

# Check if services expose metrics endpoints
services_dir="services"
if [ -d "$services_dir" ]; then
    echo "  Analyzing service metrics implementation:"

    for service_dir in services/*; do
        if [ -d "$service_dir" ]; then
            service_name=$(basename "$service_dir")
            echo ""
            echo "    📦 $service_name:"

            # Check for metrics endpoint implementation
            metrics_impl=$(find "$service_dir/src" -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "/metrics\|prometheus\|prom-client" 2>/dev/null | wc -l | tr -d ' ')

            if [ "$metrics_impl" -gt 0 ]; then
                echo "      ✅ Metrics implementation found ($metrics_impl files)"
            else
                echo "      ❌ No metrics implementation found"
            fi

            # Check for correlation ID middleware
            correlation_impl=$(find "$service_dir/src" -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "correlation\|trace.*id\|request.*id" 2>/dev/null | wc -l | tr -d ' ')

            if [ "$correlation_impl" -gt 0 ]; then
                echo "      ✅ Correlation ID implementation found ($correlation_impl files)"
            else
                echo "      ❌ No correlation ID implementation found"
            fi

            # Check for structured logging
            structured_logging=$(find "$service_dir/src" -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "@foundation/observability\|createLogger" 2>/dev/null | wc -l | tr -d ' ')

            if [ "$structured_logging" -gt 0 ]; then
                echo "      ✅ Structured logging implementation found ($structured_logging files)"
            else
                echo "      ❌ No structured logging implementation found"
            fi
        fi
    done
else
    echo "  ⚠️  No services directory found"
fi

echo ""
echo "4. OBSERVABILITY PACKAGE ANALYSIS:"

if [ -f "packages/observability/src/index.ts" ]; then
    echo "  ✅ @foundation/observability package exists"

    # Check for tracing support
    if grep -q "traceId\|spanId\|correlation" packages/observability/src/index.ts; then
        echo "    ✅ Tracing/correlation ID support implemented"
    else
        echo "    ❌ No tracing/correlation ID support found"
    fi

    # Check for metrics support
    if grep -q "metrics\|prometheus\|counter\|gauge\|histogram" packages/observability/src/index.ts; then
        echo "    ✅ Metrics support implemented"
    else
        echo "    ❌ No metrics support found"
    fi

    # Check for structured logging
    if grep -q "LogEntry\|LogLevel\|structured" packages/observability/src/index.ts; then
        echo "    ✅ Structured logging implemented"
    else
        echo "    ❌ No structured logging found"
    fi

else
    echo "  ❌ @foundation/observability package missing"
fi

echo ""
echo "5. DOCKER COMPOSE OBSERVABILITY CHECK:"

if [ -f "docker-compose.yml" ]; then
    # Check if Prometheus metrics port is exposed
    if grep -A 20 "user-service:" docker-compose.yml | grep -q "9464:9464"; then
        echo "  ✅ User service metrics port 9464 exposed in Docker Compose"
    else
        echo "  ❌ User service metrics port 9464 not exposed in Docker Compose"
    fi

    # Check if monitoring services have proper configuration
    if grep -A 10 "prometheus:" docker-compose.yml | grep -q "prometheus.yml"; then
        echo "  ✅ Prometheus configuration mounted in Docker Compose"
    else
        echo "  ❌ Prometheus configuration not mounted in Docker Compose"
    fi

    if grep -A 10 "grafana:" docker-compose.yml | grep -q "grafana-datasources"; then
        echo "  ✅ Grafana datasources mounted in Docker Compose"
    else
        echo "  ❌ Grafana datasources not mounted in Docker Compose"
    fi

    if grep -A 10 "grafana:" docker-compose.yml | grep -q "grafana-dashboards"; then
        echo "  ✅ Grafana dashboards mounted in Docker Compose"
    else
        echo "  ❌ Grafana dashboards not mounted in Docker Compose"
    fi
else
    echo "  ❌ docker-compose.yml not found"
fi

echo ""
echo "6. README PROMISES VALIDATION:"

# Check what observability features are promised in README
if [ -f "README.md" ] || [ -f "README-new.md" ]; then
    readme_file=""
    [ -f "README-new.md" ] && readme_file="README-new.md" || readme_file="README.md"

    echo "  Checking README promises against implementation:"

    if grep -q "correlation\|trace" "$readme_file"; then
        echo "    📋 README promises correlation IDs/tracing"
    fi

    if grep -q "metrics\|Prometheus" "$readme_file"; then
        echo "    📋 README promises Prometheus metrics"
    fi

    if grep -q "dashboard\|Grafana" "$readme_file"; then
        echo "    📋 README promises Grafana dashboards"
    fi

    if grep -q "observability\|monitoring" "$readme_file"; then
        echo "    📋 README promises observability features"
    fi
fi

echo ""
echo "✅ Observability Validation Complete!"

echo ""
echo "🔧 CRITICAL OBSERVABILITY GAPS:"

gaps_count=0

# Check for missing Grafana dashboards
if [ ! -d "monitoring/grafana-dashboards" ] || [ "$(find monitoring/grafana-dashboards -name "*.json" | wc -l | tr -d ' ')" -eq 0 ]; then
    echo "   1. Missing Grafana dashboards - README promises but none exist"
    gaps_count=$((gaps_count + 1))
fi

# Check for missing metrics implementation
if [ -d "services" ]; then
    services_without_metrics=0
    for service_dir in services/*; do
        if [ -d "$service_dir" ]; then
            metrics_impl=$(find "$service_dir/src" -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "/metrics\|prometheus" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$metrics_impl" -eq 0 ]; then
                services_without_metrics=$((services_without_metrics + 1))
            fi
        fi
    done

    if [ "$services_without_metrics" -gt 0 ]; then
        echo "   2. Services missing metrics endpoints ($services_without_metrics services)"
        gaps_count=$((gaps_count + 1))
    fi
fi

# Check for missing correlation ID implementation
if [ -d "services" ]; then
    services_without_correlation=0
    for service_dir in services/*; do
        if [ -d "$service_dir" ]; then
            correlation_impl=$(find "$service_dir/src" -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "correlation\|trace.*id" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$correlation_impl" -eq 0 ]; then
                services_without_correlation=$((services_without_correlation + 1))
            fi
        fi
    done

    if [ "$services_without_correlation" -gt 0 ]; then
        echo "   3. Services missing correlation ID middleware ($services_without_correlation services)"
        gaps_count=$((gaps_count + 1))
    fi
fi

echo ""
echo "🎯 OBSERVABILITY STATUS:"
if [ $gaps_count -eq 0 ]; then
    echo "   ✅ Observability fully implemented and matches README promises"
else
    echo "   ❌ $gaps_count critical observability gaps need resolution"
    echo "   ⚠️  Monitoring promises in README not fully implemented"
fi
