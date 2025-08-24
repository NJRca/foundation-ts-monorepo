# Foundation TypeScript Monorepo

A comprehensive TypeScript pnpm monorepo template with strict configurations, testing, and observability.

## Overview

This monorepo implements modern software development practices including Design by Contract (DbC), Functional Core/Imperative Shell, Strangler Fig Pattern, 12-Factor App methodology, Outside-In Development (ODD), Behavior-Driven Development (BDD), and the Mikado Method.

## Architecture

### Packages

- **`@foundation/contracts`** - Core domain contracts and interfaces
- **`@foundation/config`** - Configuration management with environment variable support
- **`@foundation/observability`** - Logging, metrics, and observability utilities
- **`@foundation/analyzer`** - Static analysis tool with SARIF output
- **`@foundation/domain-sample`** - Sample domain implementation
- **`@foundation/utils`** - Shared utility functions
- **`@foundation/app`** - Main HTTP application with health endpoints

### Key Features

- **Strict TypeScript Configuration**: Comprehensive type checking with `exactOptionalPropertyTypes` and strict null checks
- **ESLint Rules**: Enforced code quality with no `any` types and no direct `process.env` access
- **Jest Testing**: Configured for monorepo with TypeScript support
- **GitHub CI/CD**: Automated workflows for build, test, lint, and analysis
- **Static Analysis**: Custom analyzer with SARIF output for code quality
- **Health Checks**: HTTP endpoints for application monitoring
- **Documentation**: Comprehensive philosophy, ADR templates, and Mikado method guidelines

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Available Scripts

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all packages
pnpm lint

# Run static analysis
pnpm analyze

# Clean build artifacts
pnpm clean

# Start development servers
pnpm dev
```

### Running the Application

```bash
cd packages/app
pnpm build
pnpm start
```

The application will start on `http://localhost:3000` with the following endpoints:

- `GET /` - Application information
- `GET /health` - Health check endpoint

### Environment Configuration

The application supports configuration via environment variables:

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `LOG_STRUCTURED` - Use structured JSON logging (default: false)
- `LOG_LEVEL` - Logging level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, default: 1)

## Development

### Project Structure

```
├── packages/
│   ├── contracts/       # Domain interfaces and contracts
│   ├── config/         # Configuration management
│   ├── observability/  # Logging and metrics
│   ├── analyzer/       # Static analysis tool
│   ├── domain-sample/  # Sample domain logic
│   ├── utils/          # Shared utilities
│   └── app/           # HTTP application
├── tests/
│   └── acceptance/    # End-to-end tests
├── examples/          # Sample files for analysis
├── docs/             # Documentation
│   ├── philosophy.md # Development philosophies
│   ├── adr/         # Architecture Decision Records
│   └── mikado/      # Mikado method documentation
└── .github/
    └── workflows/   # CI/CD pipelines
```

### Testing

- **Unit Tests**: `pnpm test` - Run Jest tests across all packages
- **Acceptance Tests**: Located in `tests/acceptance/` for end-to-end scenarios
- **Linting**: `pnpm lint` - ESLint with strict TypeScript rules
- **Static Analysis**: `pnpm analyze` - Custom analyzer with SARIF output

### Code Quality

- **TypeScript**: Strict mode with comprehensive type checking
- **ESLint**: Enforced code style and quality rules
- **No `any` types**: Explicit typing required throughout
- **No `process.env`**: Configuration accessed through abstraction layer
- **Functional Core**: Business logic separated from side effects

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. Install dependencies
2. Lint code
3. Build all packages
4. Run tests
5. Execute static analysis
6. Upload coverage reports

## Documentation

- **Philosophy**: `docs/philosophy.md` - Core development principles
- **ADR Template**: `docs/adr/0001-architecture.md` - Architecture decision record format
- **Mikado Method**: `docs/mikado/README.md` - Large refactoring approach

## Static Analysis

The built-in analyzer detects:

- TODO comments
- Direct console usage
- Code quality issues

Generate SARIF reports with:

```bash
cd packages/analyzer
pnpm analyze
```

## Next Steps

This foundation provides a solid base for enterprise TypeScript applications. Consider these enhancements:

1. **Deeper Analyzer Integration**: Extend static analysis rules for domain-specific patterns
2. **Event Sourcing**: Implement event store with domain events
3. **API Gateway**: Add routing and middleware layers
4. **Database Integration**: Add repository implementations
5. **Microservices**: Extract packages into separate deployable services
6. **Observability**: Add distributed tracing and metrics collection
7. **Security**: Implement authentication and authorization
8. **Performance**: Add caching and optimization layers

## Contributing

1. Follow the established patterns in existing packages
2. Add tests for new functionality
3. Update documentation for architectural changes
4. Use the Mikado method for large refactoring efforts
5. Create ADRs for significant architectural decisions

## License

MIT License - see [LICENSE](LICENSE) file for details.