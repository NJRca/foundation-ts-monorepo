# 🚀 Quick Start Guide

Get up and running with the Foundation TypeScript Monorepo in minutes!

## ⚡ Instant Setup

```bash
# Clone and setup
git clone <repository-url>
cd foundation-ts-monorepo

# One-command setup
npm run full-setup

# Start the service
npm run start
```

## 🎯 Common Tasks

### Development Workflow

```bash
# Start development
npm run start:user-service:dev   # Start with auto-reload
npm run build:watch             # Build with watch mode
npm run test:watch               # Test with watch mode

# Quick validation
npm run ci:local                 # Run full CI pipeline locally
```

### Code Quality

```bash
npm run format                   # Format all code
npm run lint:fix                 # Fix lint issues automatically
npm run validate                 # Full codebase validation
```

### Utilities

```bash
npm run help                     # Show all available commands
./scripts/dev-utils.sh help      # Advanced development utilities
npm run workspace:list           # Show all packages/services
npm run deps:check               # Check dependency health
```

## 🛠️ Development Tools

### VSCode Setup

This repo includes optimized VSCode configuration:

- Auto-formatting on save
- TypeScript IntelliSense
- Debugging configurations
- Recommended extensions
- Task runners

### Available Scripts

- **Build**: `npm run build`, `npm run build:watch`, `npm run build:clean`
- **Test**: `npm run test`, `npm run test:watch`, `npm run test:coverage`
- **Lint**: `npm run lint`, `npm run lint:fix`
- **Format**: `npm run format`, `npm run format:check`
- **Start**: `npm run start`, `npm run start:user-service:dev`

### Debug Configurations

- **Debug User Service**: Full service debugging
- **Debug Tests**: Run and debug individual tests
- **Watch Modes**: Auto-rebuild and restart

## 🐳 Docker Development

```bash
# Full environment with databases
npm run dev:setup                # Setup Docker environment
npm run dev:start                # Start all services
npm run dev:logs                 # View logs
npm run dev:stop                 # Stop all services
```

## 📊 Health Checks

```bash
npm run check:health             # Check all service endpoints
./scripts/dev-utils.sh health    # Detailed health status
curl http://localhost:3001/health # Manual health check
```

## 🔧 Troubleshooting

### Common Issues

#### Build Errors

```bash
npm run clean                    # Clean build artifacts
npm run build:clean              # Clean and rebuild
```

#### Dependency Issues

```bash
./scripts/dev-utils.sh reset     # Reset entire environment
npm run deps:check               # Check dependency status
```

#### Service Not Starting

```bash
# Make sure you're in the right directory for manual start
cd services/user-service && npm run start

# Or use the root command (recommended)
npm run start
```

### Getting Help

1. **Commands**: `npm run help` - Show all available commands
2. **Utilities**: `./scripts/dev-utils.sh help` - Advanced utilities
3. **Workspace**: `npm run workspace:list` - Show project structure
4. **Validation**: `npm run validate` - Check entire codebase

## 🎉 You're Ready

The service should now be running at:

- **API**: <http://localhost:3001>
- **Health**: <http://localhost:3001/health>
- **Info**: <http://localhost:3001/api/v1/info>

Happy coding! 🚀
