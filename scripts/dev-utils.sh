#!/bin/bash

# Foundation Monorepo Development Utilities
# Provides common development tasks and shortcuts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Display help
show_help() {
    echo "🛠️  Foundation Monorepo Development Utilities"
    echo "=============================================="
    echo ""
    echo "Usage: ./scripts/dev-utils.sh [COMMAND]"
    echo ""
    echo "Available commands:"
    echo "  setup         - Quick development setup"
    echo "  reset         - Reset development environment"
    echo "  deps          - Check and update dependencies"
    echo "  workspace     - Show workspace information"
    echo "  health        - Check all services health"
    echo "  logs          - Show service logs"
    echo "  benchmark     - Run performance benchmarks"
    echo "  clean         - Clean all build artifacts"
    echo "  validate      - Validate entire codebase"
    echo "  help          - Show this help message"
    echo ""
}

# Quick setup for new developers
quick_setup() {
    log_info "Starting quick development setup..."

    # Check prerequisites
    log_info "Checking prerequisites..."
    if ! command_exists node; then
        log_error "Node.js is required but not installed"
        exit 1
    fi

    if ! command_exists npm; then
        log_error "npm is required but not installed"
        exit 1
    fi

    log_success "Prerequisites check passed"

    # Install dependencies
    log_info "Installing dependencies..."
    npm install

    # Build all packages
    log_info "Building all packages..."
    npm run build

    # Run basic validation
    log_info "Running validation..."
    npm run lint
    npm run test:ci

    log_success "Quick setup completed! 🎉"
    log_info "Try: npm run start"
}

# Reset development environment
reset_env() {
    log_warning "Resetting development environment..."

    # Clean build artifacts
    log_info "Cleaning build artifacts..."
    npm run clean

    # Remove node_modules
    log_info "Removing node_modules..."
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

    # Remove lock files
    log_info "Removing lock files..."
    rm -f package-lock.json
    find . -name "package-lock.json" -delete 2>/dev/null || true

    # Reinstall dependencies
    log_info "Reinstalling dependencies..."
    npm install

    # Rebuild
    log_info "Rebuilding packages..."
    npm run build

    log_success "Environment reset completed!"
}

# Check dependencies
check_deps() {
    log_info "Checking dependencies..."

    log_info "Checking for outdated packages..."
    npm outdated || true

    log_info "Running security audit..."
    npm audit || true

    log_info "Checking workspace dependencies..."
    npm run workspace:list
}

# Show workspace information
show_workspace_info() {
    log_info "Workspace Information"
    echo "===================="

    echo ""
    echo "📦 Packages:"
    find packages -name "package.json" -exec dirname {} \; | sort

    echo ""
    echo "🚀 Services:"
    find services -name "package.json" -exec dirname {} \; | sort

    echo ""
    echo "📊 Dependency Graph:"
    npm run workspace:graph 2>/dev/null || echo "Run 'npm install' first"
}

# Health check all services
health_check() {
    log_info "Checking service health..."

    # Check if user service is running
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
        log_success "User service is healthy"
    else
        log_warning "User service is not responding"
    fi

    # Check if database is accessible
    if curl -sf http://localhost:5432 >/dev/null 2>&1; then
        log_success "Database is accessible"
    else
        log_warning "Database is not accessible"
    fi

    # Check if Redis is accessible
    if curl -sf http://localhost:6379 >/dev/null 2>&1; then
        log_success "Redis is accessible"
    else
        log_warning "Redis is not accessible"
    fi
}

# Show service logs
show_logs() {
    log_info "Showing service logs..."
    if command_exists docker-compose; then
        docker-compose logs -f --tail=50
    else
        log_warning "Docker Compose not available"
        log_info "For user service logs, check the terminal where it's running"
    fi
}

# Run benchmarks
run_benchmarks() {
    log_info "Running performance benchmarks..."

    # Basic health endpoint benchmark
    if command_exists curl; then
        log_info "Testing user service response time..."
        time curl -s http://localhost:3001/health >/dev/null || log_warning "User service not running"
    fi

    # Build time benchmark
    log_info "Testing build performance..."
    time npm run build >/dev/null

    log_success "Benchmarks completed"
}

# Clean all artifacts
clean_all() {
    log_info "Cleaning all build artifacts..."

    npm run clean

    # Remove additional temporary files
    find . -name "*.log" -delete 2>/dev/null || true
    find . -name ".tsbuildinfo" -delete 2>/dev/null || true

    log_success "Cleanup completed"
}

# Validate entire codebase
validate_all() {
    log_info "Running full codebase validation..."

    log_info "Checking code formatting..."
    npm run format:check

    log_info "Running linter..."
    npm run lint

    log_info "Running tests..."
    npm run test:ci

    log_info "Building all packages..."
    npm run build

    log_success "Validation completed successfully! ✨"
}

# Main script logic
case "${1:-help}" in
    setup)
        quick_setup
        ;;
    reset)
        reset_env
        ;;
    deps)
        check_deps
        ;;
    workspace)
        show_workspace_info
        ;;
    health)
        health_check
        ;;
    logs)
        show_logs
        ;;
    benchmark)
        run_benchmarks
        ;;
    clean)
        clean_all
        ;;
    validate)
        validate_all
        ;;
    help|*)
        show_help
        ;;
esac
