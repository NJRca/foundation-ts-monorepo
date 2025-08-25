# Foundation TypeScript Monorepo

A comprehensive, enterprise-grade TypeScript monorepo template featuring microservices architecture, event sourcing, security, observability, and performance optimization.

## 🏗️ Architecture Overview

This monorepo implements a sophisticated microservices architecture with the following key components:

### Core Packages (`packages/`)

- **`@foundation/contracts`** - Shared interfaces and types
- **`@foundation/utils`** - Common utilities and helpers
- **`@foundation/config`** - Configuration management
- **`@foundation/observability`** - Logging, metrics, and distributed tracing
- **`@foundation/analyzer`** - Static analysis with domain-specific rules
- **`@foundation/events`** - Event sourcing and domain events
- **`@foundation/api-gateway`** - Production-ready HTTP routing and middleware with auth, rate limiting, CORS
- **`@foundation/database`** - Repository pattern and database integration
- **`@foundation/security`** - Authentication, authorization, and security utilities
- **`@foundation/performance`** - Caching, circuit breakers, and optimization

### Microservices (`services/`)

- **`user-service`** - User management with authentication (implemented)

### Roadmap

- **`auth-service`** - Dedicated authentication service
- **`notification-service`** - Notification and messaging service

### Infrastructure

- **PostgreSQL** - Primary database with UUID support
- **Redis** - Caching and session storage
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Observability dashboards
- **Docker** - Containerization and orchestration

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and Setup**

   ```bash
   git clone <your-repo-url>
   cd foundation-ts-monorepo
   pnpm install
   ```

2. **Start Development Environment**

   ```bash
   # Automated setup (recommended)
   pnpm run dev:setup

   # Or manual setup
   pnpm run build
   pnpm run dev:start
   ```

3. **Verify Installation**
   ```bash
   pnpm run check:health
   ```

### Available Services

| Service      | URL                   | Description                           |
| ------------ | --------------------- | ------------------------------------- |
| User Service | http://localhost:3001 | User management API                   |
| Grafana      | http://localhost:3000 | Observability dashboard (admin/admin) |
| Prometheus   | http://localhost:9090 | Metrics collection                    |
| PostgreSQL   | localhost:5432        | Primary database                      |
| Redis        | localhost:6379        | Cache and sessions                    |

## 📚 API Documentation

### User Service Endpoints

#### Authentication

```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@foundation.local","password":"admin123"}'

# Refresh Token
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refresh-token>"}'

# Logout
curl -X POST http://localhost:3001/api/v1/auth/logout \
  -H 'Authorization: Bearer <token>'
```

#### User Management

```bash
# Get all users
curl http://localhost:3001/api/v1/users \
  -H 'Authorization: Bearer <token>'

# Get user by ID
curl http://localhost:3001/api/v1/users/{id} \
  -H 'Authorization: Bearer <token>'

# Create user
curl -X POST http://localhost:3001/api/v1/users \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'

# Update user
curl -X PUT http://localhost:3001/api/v1/users/{id} \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe"}'

# Delete user
curl -X DELETE http://localhost:3001/api/v1/users/{id} \
  -H 'Authorization: Bearer <token>'
```

#### Health & Metrics

```bash
# Health check
curl http://localhost:3001/health

# Prometheus metrics
curl http://localhost:9464/metrics
```

## 🌐 API Gateway Demo

The `@foundation/api-gateway` package provides a comprehensive, production-ready API Gateway with advanced routing and middleware capabilities. Here's how to use it:

### Quick Start

```bash
# Run the API Gateway demo
npx ts-node examples/api-gateway-demo.ts
```

### Example Usage

```typescript
import { ApiGateway, RouteBuilder } from '@foundation/api-gateway';

const gateway = new ApiGateway({
  port: 8080,
  corsOrigins: ['http://localhost:3000'],
  rateLimiting: true,
  compression: true,
  security: { helmet: true, hidePoweredBy: true, trustProxy: false },
});

// Add a protected route with rate limiting and validation
gateway.addRoute(
  RouteBuilder.create()
    .post('/api/v1/users')
    .requireAuth()
    .rateLimit(60000, 100) // 100 requests per minute
    .validate({
      body: { email: 'string', name: 'string' },
    })
    .handler(async (req, res) => {
      res.json({ message: 'User created', data: req.body });
    })
    .build()
);

await gateway.listen();
```

### Available Endpoints (Demo)

| Method | Endpoint                 | Description             | Auth Required |
| ------ | ------------------------ | ----------------------- | ------------- |
| GET    | `/health`                | Health check            | No            |
| GET    | `/api/v1/public/info`    | Public information      | No            |
| POST   | `/api/v1/protected/data` | Protected data endpoint | Yes           |
| GET    | `/api/v1/users/:id`      | User proxy (demo)       | Yes           |

### Testing the Demo

```bash
# Health check
curl http://localhost:8080/health

# Public endpoint
curl http://localhost:8080/api/v1/public/info

# Protected endpoint (requires auth header)
curl -X POST http://localhost:8080/api/v1/protected/data \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'

# User proxy endpoint
curl http://localhost:8080/api/v1/users/123 \
  -H "Authorization: Bearer demo-token"
```

## 🛠️ Development Commands

### Package Management

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Clean build artifacts
pnpm run clean
```

### Docker & Services

```bash
# Start all services
pnpm run dev:start

# Stop all services
pnpm run dev:stop

# Restart services
pnpm run dev:restart

# View logs
pnpm run dev:logs

# Start with full stack (all services)
pnpm run dev:full

# Clean up (removes volumes)
pnpm run dev:clean
```

### Individual Services

```bash
# Start only databases
pnpm run db:up

# Start only monitoring
pnpm run monitoring:up

# Start only user service
pnpm run services:user

# Build service containers
pnpm run services:build
```

### Security & Analysis

```bash
# Run static analysis
pnpm run analyze:security

# Analyze specific package
pnpm --filter @foundation/analyzer run analyze
```

## 🏢 Package Architecture

### Dependency Graph

```
services/user-service
├── @foundation/database
├── @foundation/security
├── @foundation/events
├── @foundation/observability
└── @foundation/contracts

@foundation/database
├── @foundation/observability
└── @foundation/contracts

@foundation/security
├── @foundation/observability
└── @foundation/contracts

@foundation/events
├── @foundation/observability
└── @foundation/contracts

@foundation/api-gateway
├── @foundation/security
├── @foundation/observability
└── @foundation/contracts
```

### Package Features

#### `@foundation/analyzer`

- SARIF-compliant static analysis
- Domain-specific rules (database access, error handling, secrets)
- Integration with security scanning tools
- Customizable rule engine

#### `@foundation/events`

- Event sourcing with in-memory event store
- Domain events and aggregate roots
- Event bus for decoupled communication
- Audit trail and replay capabilities

#### `@foundation/api-gateway` ✅

**Comprehensive API Gateway Implementation**

- **Fluent Route Builder API** - Chainable route configuration with method shortcuts
- **Authentication & Authorization** - JWT-based auth middleware with configurable requirements
- **Rate Limiting** - Per-IP rate limiting with sliding window and custom limits
- **CORS Support** - Configurable cross-origin resource sharing with credential support
- **Request Validation** - Schema-based validation for body, query, and path parameters
- **Security Middleware** - Helmet integration, request sanitization, and security headers
- **Request Context** - Distributed tracing with request IDs and structured logging
- **Error Handling** - Comprehensive error boundaries with proper HTTP status codes
- **Health Checks** - Built-in health, readiness, and liveness endpoints
- **Compression** - Automatic response compression for large payloads

```typescript
// Example: Fluent API usage
const gateway = new ApiGateway(config);

gateway.addRoute(
  RouteBuilder.create()
    .post('/api/users')
    .requireAuth()
    .rateLimit(60000, 100) // 100 requests per minute
    .validate({ body: { email: 'string', name: 'string' } })
    .handler(async (req, res) => {
      // Handler implementation
    })
    .build()
);
```

#### `@foundation/database`

- Repository pattern implementation
- PostgreSQL and Redis integration
- Connection pooling and health checks
- Migration management

#### `@foundation/security`

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Security middleware and utilities

#### `@foundation/performance`

- Multiple caching strategies (LRU, LFU, TTL)
- Circuit breaker pattern
- Rate limiting
- Performance monitoring and metrics

#### `@foundation/observability`

- Structured logging with correlation IDs
- Distributed tracing support
- Prometheus metrics integration
- Request/response logging middleware

## 🔒 Security Features

### Authentication & Authorization

- JWT tokens with refresh token rotation
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management with Redis

### Security Middleware

- Authentication validation
- Authorization checks
- Rate limiting
- CORS protection
- Request sanitization

### Static Analysis

- Hardcoded secret detection
- SQL injection pattern detection
- Missing error handling detection
- Insecure dependency usage

## 📊 Observability

### Metrics Collection

- HTTP request metrics (duration, status codes, paths)
- Database query performance
- Cache hit/miss ratios
- Custom business metrics

### Logging

- Structured JSON logging
- Correlation ID tracking
- Request/response logging
- Error tracking and alerting

### Distributed Tracing

- OpenTelemetry-compatible tracing
- Request flow visualization
- Performance bottleneck identification
- Service dependency mapping

### Dashboards

- Pre-configured Grafana dashboards
- Service health monitoring
- Performance metrics visualization
- Error rate tracking

## 🧪 Testing Strategy

### Unit Tests

```bash
# Run all tests
pnpm run test

# Run tests for specific package
pnpm --filter @foundation/security run test

# Run tests with coverage
pnpm run test -- --coverage
```

### Integration Tests

```bash
# Run acceptance tests
cd tests/acceptance
pnpm test
```

### Load Testing

```bash
# Example load test (requires k6 or similar)
k6 run scripts/load-test.js
```

## 🔄 CI/CD Pipeline

### Comprehensive CI Pipeline

Our CI pipeline enforces strict quality gates to keep the main branch clean and ensure code quality:

#### Pipeline Stages

1. **TypeScript Typecheck** - Validates all TypeScript compilation
2. **ESLint** - Code quality and style enforcement
3. **Unit Tests** - Comprehensive test suite with coverage
4. **Acceptance Tests** - End-to-end integration testing
5. **Static Analysis** - SARIF-compliant security and quality analysis
6. **SARIF Upload** - Automatic upload to GitHub Security tab

#### Required Commands

```bash
# Run the complete CI pipeline locally
pnpm run ci:local

# Individual pipeline steps
pnpm run typecheck          # TypeScript compilation check
pnpm run lint               # ESLint validation
pnpm run test:ci            # Unit tests with coverage
pnpm run analyze:sarif      # Static analysis with SARIF output

# Validation commands
pnpm run ci:validate        # Format, lint, and test validation
pnpm run format:check       # Check code formatting
```

#### CI Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  ci-pipeline:
    steps:
      - TypeScript typecheck
      - ESLint validation
      - Build all packages
      - Unit tests with coverage
      - Acceptance tests
      - Static analysis (SARIF)
      - Upload to GitHub Security
```

### Branch Protection

**Main branch is protected with:**

- ✅ **Pull request required** - No direct pushes to main
- ✅ **CI status checks** - All pipeline stages must pass
- ✅ **Code review required** - Minimum 1 approval
- ✅ **Up-to-date branches** - Must be current with main
- ✅ **SARIF security scanning** - Automatic vulnerability detection

See [Branch Protection Guide](.github/BRANCH_PROTECTION.md) for setup instructions.

### Pull Request Workflow

Every PR must include:

1. **Mikado Method Links** - Reference to architecture planning
2. **Boy Scout Rule** - Code improvements beyond the immediate change
3. **Static Analysis Delta** - Before/after comparison of issues
4. **Comprehensive Testing** - Unit, integration, and acceptance tests
5. **Security Review** - SARIF findings addressed

### Quality Gates

| Gate              | Requirement                         | Enforcement        |
| ----------------- | ----------------------------------- | ------------------ |
| **Typecheck**     | Zero TypeScript errors              | CI blocking        |
| **Lint**          | Zero ESLint errors                  | CI blocking        |
| **Tests**         | 100% test pass, coverage maintained | CI blocking        |
| **Security**      | No new critical/high SARIF issues   | Review required    |
| **Code Review**   | Minimum 1 approval                  | GitHub enforcement |
| **Documentation** | Updated for API changes             | Review required    |

### CI Commands Reference

```bash
# Development workflow
pnpm run build              # Build all packages
pnpm run test:watch         # Tests in watch mode
pnpm run analyze            # Run static analyzer

# Pre-commit validation
pnpm run format             # Auto-format code
pnpm run lint:fix           # Auto-fix lint issues
pnpm run ci:local           # Full CI pipeline locally

# CI troubleshooting
pnpm run test:ci            # Exact CI test command
pnpm run typecheck          # Explicit type checking
pnpm run analyze:sarif      # Generate SARIF report
```

### Continuous Integration Best Practices

#### For Developers

- **Run CI locally** before pushing (`pnpm run ci:local`)
- **Fix all lint issues** before committing
- **Maintain test coverage** for new code
- **Review SARIF reports** and address security findings
- **Follow PR template** completely

#### For Maintainers

- **Monitor CI performance** and optimize slow steps
- **Review SARIF trends** in GitHub Security tab
- **Update pipeline** as project grows
- **Enforce quality gates** consistently
- **Document CI changes** in ADRs

## 🚀 Deployment

### Docker Compose (Development)

```bash
# Start all services
docker-compose up -d

# Start with full stack
docker-compose --profile full-stack up -d
```

### Production Deployment

1. Build production images
2. Deploy to Kubernetes or container orchestration platform
3. Configure external PostgreSQL and Redis
4. Set up monitoring and alerting
5. Configure load balancing and SSL termination

### Environment Variables

See individual service README files for specific environment variable requirements.

## 📁 Project Structure

```
foundation-ts-monorepo/
├── packages/                  # Shared packages
│   ├── analyzer/             # Static analysis tools
│   ├── api-gateway/          # HTTP routing and middleware
│   ├── config/               # Configuration management
│   ├── contracts/            # Shared interfaces
│   ├── database/             # Database integration
│   ├── events/               # Event sourcing
│   ├── observability/        # Logging and metrics
│   ├── performance/          # Caching and optimization
│   ├── security/             # Authentication and authorization
│   └── utils/                # Common utilities
├── services/                 # Microservices
│   └── user-service/         # User management service
├── docs/                     # Documentation
├── examples/                 # Usage examples
├── monitoring/               # Monitoring configuration
├── scripts/                  # Development scripts
├── sql/                      # Database initialization
├── tests/                    # Integration tests
├── docker-compose.yml        # Container orchestration
└── pnpm-workspace.yaml       # Workspace configuration
```

## 🤝 Contributing

### Development Workflow

1. Create feature branch
2. Make changes following coding standards
3. Run tests and linting
4. Submit pull request
5. Pass CI/CD checks
6. Code review and merge

### Coding Standards

- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Conventional commits
- 100% test coverage for new features

### Adding New Services

1. Create service directory in `services/`
2. Copy template from existing service
3. Update dependencies and configuration
4. Add service to docker-compose.yml
5. Update documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenTelemetry for observability standards
- Express.js for HTTP framework
- PostgreSQL for robust database support
- Redis for caching and session management
- Prometheus & Grafana for monitoring
- Docker for containerization
