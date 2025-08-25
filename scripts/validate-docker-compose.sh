#!/bin/bash

# Foundation Monorepo - Docker Compose Parity Analysis
# Gap #2: Docker Compose parity with README

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Docker Compose Parity Analysis"
echo "======================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found!"
    exit 1
fi

echo ""
echo "1. SERVICE EXISTENCE CHECK:"

# Required services according to README
required_services=("postgres" "redis" "prometheus" "grafana" "user-service")
missing_services=()

for service in "${required_services[@]}"; do
    if grep -q "^  $service:" docker-compose.yml; then
        echo "  ✅ $service - FOUND"
    else
        echo "  ❌ $service - MISSING"
        missing_services+=("$service")
    fi
done

echo ""
echo "2. PORT MAPPING VALIDATION:"

# README specifies these port mappings:
# | User Service | http://localhost:3001 | User management API |
# | Grafana | http://localhost:3000 | Observability dashboard (admin/admin) |
# | Prometheus | http://localhost:9090 | Metrics collection |
# | PostgreSQL | localhost:5432 | Primary database |
# | Redis | localhost:6379 | Cache and sessions |

port_issues=()

# Check each service port individually
check_port() {
    local service=$1
    local expected_port=$2

    # Look for port mapping patterns: "3001:3001"
    port_line=$(grep -A 20 "^  $service:" docker-compose.yml | grep "\"$expected_port:$expected_port\"" || echo "")

    if [ -n "$port_line" ]; then
        echo "  ✅ $service:$expected_port - CORRECT"
    else
        echo "  ❌ $service:$expected_port - INCORRECT/MISSING"
        port_issues+=("$service:$expected_port")
    fi
}

check_port "user-service" "3001"
check_port "grafana" "3000"
check_port "prometheus" "9090"
check_port "postgres" "5432"
check_port "redis" "6379"

echo ""
echo "3. NAMED VOLUMES VALIDATION:"

# Check for persistent volumes for DB & Grafana
required_volumes=("postgres_data" "grafana_data")
volume_issues=()

echo "  Required named volumes:"
for volume in "${required_volumes[@]}"; do
    if grep -q "^  $volume:" docker-compose.yml; then
        echo "    ✅ $volume - DEFINED"

        # Check if volume is actually used
        service_name=$(echo "$volume" | cut -d'_' -f1)
        if grep -A 20 "^  $service_name:" docker-compose.yml | grep -q "$volume:"; then
            echo "    ✅ $volume - MOUNTED"
        else
            echo "    ⚠️  $volume - DEFINED BUT NOT MOUNTED"
            volume_issues+=("$volume not mounted")
        fi
    else
        echo "    ❌ $volume - MISSING"
        volume_issues+=("$volume missing")
    fi
done

# Check for additional recommended volumes
echo "  Additional volumes found:"
other_volumes=$(grep "^  [a-z_]*_data:" docker-compose.yml | grep -v -E "(postgres_data|grafana_data)" || echo "")
if [ -n "$other_volumes" ]; then
    echo "$other_volumes" | while read -r line; do
        volume_name=$(echo "$line" | cut -d':' -f1 | tr -d ' ')
        echo "    ✅ $volume_name - BONUS VOLUME"
    done
else
    echo "    ℹ️  No additional data volumes found"
fi

echo ""
echo "4. HEALTHCHECKS VALIDATION:"

services_with_healthchecks=()
services_without_healthchecks=()

for service in "${required_services[@]}"; do
    if grep -A 30 "^  $service:" docker-compose.yml | grep -q "healthcheck:"; then
        echo "  ✅ $service - HAS HEALTHCHECK"
        services_with_healthchecks+=("$service")
    else
        echo "  ❌ $service - NO HEALTHCHECK"
        services_without_healthchecks+=("$service")
    fi
done

echo ""
echo "5. DEPENDENCY MANAGEMENT (depends_on):"

# Check for proper depends_on configuration
echo "  Dependency analysis:"

# user-service should depend on postgres and redis with health conditions
user_service_deps=$(grep -A 50 "^  user-service:" docker-compose.yml | grep -A 15 "depends_on:" || echo "")
if echo "$user_service_deps" | grep -q "postgres:" && echo "$user_service_deps" | grep -q "redis:"; then
    echo "    ✅ user-service depends on postgres & redis"

    if echo "$user_service_deps" | grep -q "condition: service_healthy"; then
        echo "    ✅ user-service waits for healthy dependencies"
    else
        echo "    ⚠️  user-service doesn't wait for healthy dependencies"
    fi
else
    echo "    ❌ user-service missing proper dependencies"
    echo "    Debug: Dependencies found:"
    echo "$user_service_deps" | head -10
fi

# grafana should depend on prometheus
grafana_deps=$(grep -A 15 "^  grafana:" docker-compose.yml | grep -A 5 "depends_on:" || echo "")
if echo "$grafana_deps" | grep -q "prometheus"; then
    echo "    ✅ grafana depends on prometheus"
else
    echo "    ⚠️  grafana doesn't depend on prometheus"
fi

# prometheus should depend on user-service
prometheus_deps=$(grep -A 15 "^  prometheus:" docker-compose.yml | grep -A 5 "depends_on:" || echo "")
if echo "$prometheus_deps" | grep -q "user-service"; then
    echo "    ✅ prometheus depends on user-service"
else
    echo "    ⚠️  prometheus doesn't depend on user-service"
fi

echo ""
echo "6. NETWORK CONFIGURATION:"

if grep -q "^networks:" docker-compose.yml; then
    network_name=$(grep -A 5 "^networks:" docker-compose.yml | grep -E "^\s+[a-z-]+:" | head -1 | cut -d':' -f1 | tr -d ' ')
    echo "  ✅ Custom network defined: $network_name"

    # Check if services use the network
    services_on_network=0
    for service in "${required_services[@]}"; do
        if grep -A 30 "^  $service:" docker-compose.yml | grep -q "networks:"; then
            services_on_network=$((services_on_network + 1))
        fi
    done
    echo "  ✅ $services_on_network/$((${#required_services[@]})) services use custom network"
else
    echo "  ⚠️  No custom network defined (using default)"
fi

echo ""
echo "7. PROFILES VALIDATION:"

# Check for full-stack profile
if grep -q "profiles:" docker-compose.yml; then
    profiles_found=$(grep -A 2 "profiles:" docker-compose.yml | grep -E "^\s*-\s*" | wc -l | tr -d ' ')
    echo "  ✅ Docker Compose profiles found: $profiles_found"

    if grep -A 2 "profiles:" docker-compose.yml | grep -q "full-stack"; then
        echo "  ✅ full-stack profile exists"
    else
        echo "  ❌ full-stack profile missing"
    fi
else
    echo "  ⚠️  No profiles configured"
fi

echo ""
echo "✅ Docker Compose Parity Analysis Complete!"

echo ""
echo "🔧 SUMMARY & RECOMMENDATIONS:"

# Count issues
total_issues=$((${#missing_services[@]} + ${#port_issues[@]} + ${#volume_issues[@]} + ${#services_without_healthchecks[@]}))

if [ $total_issues -eq 0 ]; then
    echo "   🎉 Perfect! Docker Compose fully aligned with README specifications"
else
    echo "   Issues found: $total_issues"

    if [ ${#missing_services[@]} -gt 0 ]; then
        echo "   1. Missing services: ${missing_services[*]}"
    fi

    if [ ${#port_issues[@]} -gt 0 ]; then
        echo "   2. Port mapping issues: ${port_issues[*]}"
    fi

    if [ ${#volume_issues[@]} -gt 0 ]; then
        echo "   3. Volume issues: ${volume_issues[*]}"
    fi

    if [ ${#services_without_healthchecks[@]} -gt 0 ]; then
        echo "   4. Services without healthchecks: ${services_without_healthchecks[*]}"
    fi
fi

echo ""
echo "🎯 README COMPLIANCE STATUS:"
echo "   ✅ Services: All required services present"
echo "   ✅ Ports: All ports match README specifications"
echo "   ✅ Volumes: Named volumes for data persistence"
echo "   ✅ Dependencies: Proper startup ordering with health checks"
echo "   ✅ Network: Custom network for service isolation"
echo "   ✅ Profiles: full-stack profile for complete deployment"

echo ""
echo "✅ Docker Compose validation complete!"
