#!/bin/bash

# Foundation TypeScript Monorepo - Development Environment Manager
# This script provides a comprehensive development experience with observability

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
USER_SERVICE_PORT=${USER_SERVICE_PORT:-3001}
GRAFANA_PORT=${GRAFANA_PORT:-3000}
PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 1
    else
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=${3:-30}
    local attempt=1

    log_info "Waiting for $service_name to be ready at $url..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            log "✅ $service_name is ready!"
            return 0
        fi

        if [ $attempt -eq $max_attempts ]; then
            log_error "❌ $service_name failed to start after $max_attempts attempts"
            return 1
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done
}

# Function to check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."

    local missing_deps=()

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_warn "Node.js version $node_version detected. Version 18+ recommended."
        fi
    fi

    # Check npm/pnpm
    if ! command -v npm &> /dev/null && ! command -v pnpm &> /dev/null; then
        missing_deps+=("npm or pnpm")
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi

    # Check curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again."
        exit 1
    fi

    log "✅ All prerequisites satisfied"
}

# Function to setup environment
setup_environment() {
    log "🔧 Setting up development environment..."

    # Create .env file if it doesn't exist
    if [ ! -f "$PROJECT_ROOT/.env" ]; then
        log_info "Creating .env file with development defaults..."
        cat > "$PROJECT_ROOT/.env" << EOF
# Development Environment Configuration
NODE_ENV=development
PORT=$USER_SERVICE_PORT

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=foundation_dev
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-make-it-at-least-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-make-it-at-least-32-characters

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:$USER_SERVICE_PORT

# Logging
LOG_LEVEL=debug
EOF
        log "✅ Created .env file with development defaults"
    fi

    # Install dependencies
    log_info "Installing dependencies..."
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi

    log "✅ Environment setup complete"
}

# Function to build the project
build_project() {
    log "🔨 Building project..."

    if command -v pnpm &> /dev/null; then
        pnpm run build
    else
        npm run build
    fi

    log "✅ Build complete"
}

# Function to start infrastructure services
start_infrastructure() {
    log "🐳 Starting infrastructure services..."

    # Start Docker Compose services
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        docker-compose up -d

        # Wait for services to be ready
        wait_for_service "http://localhost:5432" "PostgreSQL" 60
        wait_for_service "http://localhost:6379" "Redis" 30
        wait_for_service "http://localhost:$PROMETHEUS_PORT" "Prometheus" 30
        wait_for_service "http://localhost:$GRAFANA_PORT" "Grafana" 60
    else
        log_warn "No docker-compose.yml found. Infrastructure services need to be started manually."
    fi

    log "✅ Infrastructure services started"
}

# Function to start the user service
start_user_service() {
    log "🚀 Starting user service with observability..."

    cd "$PROJECT_ROOT/services/user-service"

    # Check if observability server exists, otherwise use minimal
    if [ -f "src/server-observability.ts" ]; then
        log_info "Using observability-enabled server"

        # Compile TypeScript
        npx tsc src/server-observability.ts --outDir ./temp --target es2022 --module commonjs --esModuleInterop --skipLibCheck

        # Start server
        PORT=$USER_SERVICE_PORT node ./temp/server-observability.js &
        SERVER_PID=$!
        echo $SERVER_PID > "$PROJECT_ROOT/.user-service.pid"
    else
        log_info "Using minimal server"
        if command -v pnpm &> /dev/null; then
            pnpm run start:user-service:dev &
        else
            npm run start:user-service:dev &
        fi
        SERVER_PID=$!
        echo $SERVER_PID > "$PROJECT_ROOT/.user-service.pid"
    fi

    cd "$PROJECT_ROOT"

    # Wait for user service to be ready
    wait_for_service "http://localhost:$USER_SERVICE_PORT/health" "User Service" 30

    log "✅ User service started on port $USER_SERVICE_PORT"
}

# Function to run health checks
run_health_checks() {
    log "🏥 Running health checks..."

    local all_healthy=true

    # Check user service health
    if curl -s "http://localhost:$USER_SERVICE_PORT/health" | grep -q "healthy"; then
        log "✅ User Service: Healthy"
    else
        log_error "❌ User Service: Unhealthy"
        all_healthy=false
    fi

    # Check metrics endpoint
    if curl -s "http://localhost:$USER_SERVICE_PORT/metrics" | grep -q "http_requests_total"; then
        log "✅ Metrics Endpoint: Available"
    else
        log_error "❌ Metrics Endpoint: Unavailable"
        all_healthy=false
    fi

    # Check Grafana (if running)
    if check_port $GRAFANA_PORT; then
        log_warn "⚠️  Grafana: Not running on port $GRAFANA_PORT"
    else
        log "✅ Grafana: Running on port $GRAFANA_PORT"
    fi

    # Check Prometheus (if running)
    if check_port $PROMETHEUS_PORT; then
        log_warn "⚠️  Prometheus: Not running on port $PROMETHEUS_PORT"
    else
        log "✅ Prometheus: Running on port $PROMETHEUS_PORT"
    fi

    if $all_healthy; then
        log "✅ All critical services are healthy"
        return 0
    else
        log_error "❌ Some services are unhealthy"
        return 1
    fi
}

# Function to show service URLs
show_service_urls() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}   🚀 Development Environment Ready   ${NC}"
    echo -e "${PURPLE}========================================${NC}"
    echo ""
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  🔧 User Service:     ${GREEN}http://localhost:$USER_SERVICE_PORT${NC}"
    echo -e "  📊 Health Check:     ${GREEN}http://localhost:$USER_SERVICE_PORT/health${NC}"
    echo -e "  📈 Metrics:          ${GREEN}http://localhost:$USER_SERVICE_PORT/metrics${NC}"
    echo -e "  📋 API Info:         ${GREEN}http://localhost:$USER_SERVICE_PORT/api/v1/info${NC}"
    echo ""
    echo -e "${CYAN}Infrastructure:${NC}"
    echo -e "  📊 Grafana:          ${GREEN}http://localhost:$GRAFANA_PORT${NC} (admin/admin)"
    echo -e "  📈 Prometheus:       ${GREEN}http://localhost:$PROMETHEUS_PORT${NC}"
    echo -e "  🗄️  PostgreSQL:       ${GREEN}localhost:5432${NC}"
    echo -e "  🔄 Redis:            ${GREEN}localhost:6379${NC}"
    echo ""
    echo -e "${CYAN}API Examples:${NC}"
    echo -e "  ${YELLOW}curl http://localhost:$USER_SERVICE_PORT/health${NC}"
    echo -e "  ${YELLOW}curl http://localhost:$USER_SERVICE_PORT/api/v1/users${NC}"
    echo -e "  ${YELLOW}curl -X POST http://localhost:$USER_SERVICE_PORT/api/v1/auth/login \\${NC}"
    echo -e "  ${YELLOW}    -H 'Content-Type: application/json' \\${NC}"
    echo -e "  ${YELLOW}    -d '{\"email\":\"admin@foundation.local\",\"password\":\"admin123\"}'${NC}"
    echo ""
    echo -e "${CYAN}Development Commands:${NC}"
    echo -e "  ${YELLOW}./dev-environment.sh stop${NC}     - Stop all services"
    echo -e "  ${YELLOW}./dev-environment.sh restart${NC}  - Restart services"
    echo -e "  ${YELLOW}./dev-environment.sh logs${NC}     - View service logs"
    echo -e "  ${YELLOW}./dev-environment.sh test${NC}     - Run API tests"
    echo ""
}

# Function to stop services
stop_services() {
    log "🛑 Stopping services..."

    # Stop user service
    if [ -f "$PROJECT_ROOT/.user-service.pid" ]; then
        local pid=$(cat "$PROJECT_ROOT/.user-service.pid")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            log "✅ User service stopped"
        fi
        rm -f "$PROJECT_ROOT/.user-service.pid"
    fi

    # Stop Docker services
    if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        docker-compose down
        log "✅ Infrastructure services stopped"
    fi
}

# Function to restart services
restart_services() {
    log "🔄 Restarting services..."
    stop_services
    sleep 2
    start_infrastructure
    start_user_service
    run_health_checks
    show_service_urls
}

# Function to view logs
view_logs() {
    log "📋 Viewing service logs..."

    if [ -f "$PROJECT_ROOT/.user-service.pid" ]; then
        local pid=$(cat "$PROJECT_ROOT/.user-service.pid")
        echo -e "${CYAN}User Service Logs (PID: $pid):${NC}"
        tail -f /dev/null &  # This is just a placeholder since we don't have log files
        echo "Logs are displayed in the terminal where the service was started."
        echo "For Docker services, use: docker-compose logs -f"
    else
        log_warn "No user service PID found. Service may not be running."
    fi
}

# Function to run API tests
run_api_tests() {
    log "🧪 Running API tests..."

    if [ -f "$PROJECT_ROOT/test-observability.sh" ]; then
        bash "$PROJECT_ROOT/test-observability.sh"
    else
        log_info "Running basic API tests..."

        echo ""
        echo -e "${CYAN}Testing Health Endpoint:${NC}"
        curl -s "http://localhost:$USER_SERVICE_PORT/health" | jq . 2>/dev/null || curl -s "http://localhost:$USER_SERVICE_PORT/health"

        echo ""
        echo -e "${CYAN}Testing Metrics Endpoint:${NC}"
        curl -s "http://localhost:$USER_SERVICE_PORT/metrics" | head -10

        echo ""
        echo -e "${CYAN}Testing API Info:${NC}"
        curl -s "http://localhost:$USER_SERVICE_PORT/api/v1/info" | jq . 2>/dev/null || curl -s "http://localhost:$USER_SERVICE_PORT/api/v1/info"
    fi
}

# Main function
main() {
    local command=${1:-start}

    case $command in
        start)
            check_prerequisites
            setup_environment
            build_project
            start_infrastructure
            start_user_service
            run_health_checks
            show_service_urls
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            view_logs
            ;;
        test)
            run_api_tests
            ;;
        health)
            run_health_checks
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|logs|test|health}"
            echo ""
            echo "Commands:"
            echo "  start    - Start the complete development environment"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart all services"
            echo "  logs     - View service logs"
            echo "  test     - Run API tests"
            echo "  health   - Check service health"
            exit 1
            ;;
    esac
}

# Handle script interruption
cleanup() {
    echo ""
    log_warn "Received interrupt signal. Stopping services..."
    stop_services
    exit 0
}

trap cleanup INT TERM

# Run main function with all arguments
main "$@"
