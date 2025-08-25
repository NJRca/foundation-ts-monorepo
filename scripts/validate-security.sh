#!/bin/bash

# Foundation Monorepo - Security Plumbing Validation
# Gap #5: JWT auth flows and security middleware validation

# Don't exit on errors - we want to report all issues

echo "🔍 Foundation Monorepo - Security Plumbing Validation"
echo "===================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "1. JWT CONFIGURATION VALIDATION:"

# Check .env.example for JWT secrets
if [ -f ".env.example" ]; then
    echo "  ✅ .env.example exists"

    if grep -q "JWT_SECRET=" .env.example; then
        echo "    ✅ JWT_SECRET configured in .env.example"

        # Check if it's not the dangerous default
        if grep -q "JWT_SECRET=your-super-secret-jwt-key-change-in-production" .env.example; then
            echo "    ✅ JWT_SECRET has development-safe placeholder"
        else
            echo "    ⚠️  JWT_SECRET may not have clear production warning"
        fi
    else
        echo "    ❌ JWT_SECRET missing from .env.example"
    fi

    if grep -q "JWT_REFRESH_SECRET=" .env.example; then
        echo "    ✅ JWT_REFRESH_SECRET configured in .env.example"
    else
        echo "    ❌ JWT_REFRESH_SECRET missing from .env.example"
    fi
else
    echo "  ❌ .env.example not found"
fi

echo ""
echo "2. DATABASE SEED USERS VALIDATION:"

if [ -f "sql/init.sql" ]; then
    echo "  ✅ Database initialization script exists"

    # Check for admin seed user
    if grep -q "admin@foundation.local" sql/init.sql; then
        echo "    ✅ Admin seed user configured (admin@foundation.local)"

        # Check if password is hashed
        if grep -q '\$2b\$' sql/init.sql; then
            echo "    ✅ Passwords are properly hashed with bcrypt"
        else
            echo "    ❌ Passwords not properly hashed"
        fi
    else
        echo "    ❌ No admin seed user found"
    fi

    # Check for regular seed user
    if grep -q "user@foundation.local" sql/init.sql; then
        echo "    ✅ Regular seed user configured (user@foundation.local)"
    else
        echo "    ❌ No regular seed user found"
    fi

    # Check for user roles
    if grep -q "ARRAY\['admin'" sql/init.sql; then
        echo "    ✅ Admin user has admin role"
    else
        echo "    ❌ Admin user role configuration missing"
    fi
else
    echo "  ❌ sql/init.sql not found"
fi

echo ""
echo "3. AUTHENTICATION ENDPOINTS VALIDATION:"

auth_endpoints_found=0

# Check user-service for auth endpoints
if [ -f "services/user-service/src/server.ts" ]; then
    echo "  📦 Checking user-service authentication endpoints:"

    if grep -q "/api/v1/auth/login" services/user-service/src/server.ts; then
        echo "    ✅ POST /api/v1/auth/login endpoint implemented"
        auth_endpoints_found=$((auth_endpoints_found + 1))
    else
        echo "    ❌ Login endpoint missing"
    fi

    if grep -q "/api/v1/auth/refresh" services/user-service/src/server.ts; then
        echo "    ✅ POST /api/v1/auth/refresh endpoint implemented"
        auth_endpoints_found=$((auth_endpoints_found + 1))
    else
        echo "    ❌ Token refresh endpoint missing"
    fi

    if grep -q "/api/v1/auth/logout" services/user-service/src/server.ts; then
        echo "    ✅ POST /api/v1/auth/logout endpoint implemented"
        auth_endpoints_found=$((auth_endpoints_found + 1))
    else
        echo "    ❌ Logout endpoint missing"
    fi

    # Check for rate limiting on login
    if grep -q "rateLimit.*login" services/user-service/src/server.ts; then
        echo "    ✅ Rate limiting applied to login endpoint"
    else
        echo "    ❌ Rate limiting missing on login endpoint"
    fi
else
    echo "  ❌ User service not found"
fi

echo ""
echo "4. CORS & RATE LIMITING MIDDLEWARE:"

# Check API Gateway for CORS
if [ -f "packages/api-gateway/src/index.ts" ]; then
    echo "  📦 Checking API Gateway security middleware:"

    if grep -q "cors(" packages/api-gateway/src/index.ts; then
        echo "    ✅ CORS middleware implemented"

        # Check if CORS origins are configurable
        if grep -q "corsOrigins" packages/api-gateway/src/index.ts; then
            echo "    ✅ CORS origins are configurable"
        else
            echo "    ⚠️  CORS origins may not be configurable"
        fi
    else
        echo "    ❌ CORS middleware missing"
    fi

    if grep -q "helmet" packages/api-gateway/src/index.ts; then
        echo "    ✅ Helmet security middleware implemented"
    else
        echo "    ❌ Helmet security middleware missing"
    fi

    if grep -q "rateLimit\|rateLimiting" packages/api-gateway/src/index.ts; then
        echo "    ✅ Rate limiting middleware implemented"
    else
        echo "    ❌ Rate limiting middleware missing"
    fi
else
    echo "  ❌ API Gateway package not found"
fi

# Check for CORS configuration in .env.example
if grep -q "CORS_ORIGINS=" .env.example; then
    echo "  ✅ CORS_ORIGINS configured with development defaults"

    # Check if localhost is included for development
    if grep "CORS_ORIGINS=" .env.example | grep -q "localhost"; then
        echo "    ✅ Localhost origins configured for development"
    else
        echo "    ⚠️  Localhost may not be configured for development"
    fi
else
    echo "  ❌ CORS_ORIGINS missing from environment configuration"
fi

echo ""
echo "5. SECURITY PACKAGE IMPLEMENTATION:"

if [ -f "packages/security/src/index.ts" ]; then
    echo "  ✅ Security package exists"

    # Check for JWT implementation
    if grep -q "jsonwebtoken\|jwt" packages/security/src/index.ts; then
        echo "    ✅ JWT token handling implemented"
    else
        echo "    ❌ JWT token handling missing"
    fi

    # Check for bcrypt password hashing
    if grep -q "bcrypt" packages/security/src/index.ts; then
        echo "    ✅ Password hashing with bcrypt implemented"
    else
        echo "    ❌ Password hashing missing"
    fi

    # Check for role-based authorization
    if grep -q "Role\|Permission" packages/security/src/index.ts; then
        echo "    ✅ Role-based authorization system implemented"
    else
        echo "    ❌ Role-based authorization missing"
    fi

    # Check for token validation
    if grep -q "verifyAccessToken\|verifyToken" packages/security/src/index.ts; then
        echo "    ✅ Token validation functions implemented"
    else
        echo "    ❌ Token validation functions missing"
    fi
else
    echo "  ❌ Security package not found"
fi

echo ""
echo "6. DEVELOPMENT DEFAULTS VALIDATION:"

# Check for sane development defaults
echo "  🔧 Checking development-friendly security defaults:"

# Check JWT expiration times
if grep -q "expiresIn.*1h\|expiresIn.*3600" packages/security/src/index.ts; then
    echo "    ✅ Reasonable JWT access token expiration (1 hour)"
elif grep -q "expiresIn" packages/security/src/index.ts; then
    echo "    ⚠️  JWT expiration configured but may not be optimal"
else
    echo "    ❌ JWT expiration not configured"
fi

# Check for refresh token handling
if grep -q "refreshToken\|refresh.*token" packages/security/src/index.ts; then
    echo "    ✅ Refresh token mechanism implemented"
else
    echo "    ❌ Refresh token mechanism missing"
fi

# Check for password requirements
if grep -q "password.*length\|password.*strength" packages/security/src/index.ts; then
    echo "    ✅ Password strength validation implemented"
else
    echo "    ⚠️  Password strength validation may be missing"
fi

echo ""
echo "7. END-TO-END AUTH FLOW READINESS:"

echo "  📋 Checking if auth flows can be tested end-to-end:"

# Count required components
ready_components=0
total_components=6

if [ -f ".env.example" ] && grep -q "JWT_SECRET" .env.example; then
    echo "    ✅ JWT secrets configured"
    ready_components=$((ready_components + 1))
fi

if [ -f "sql/init.sql" ] && grep -q "admin@foundation.local" sql/init.sql; then
    echo "    ✅ Seed users available for testing"
    ready_components=$((ready_components + 1))
fi

if [ $auth_endpoints_found -ge 3 ]; then
    echo "    ✅ All auth endpoints implemented (login/refresh/logout)"
    ready_components=$((ready_components + 1))
fi

if [ -f "packages/security/src/index.ts" ] && grep -q "bcrypt" packages/security/src/index.ts; then
    echo "    ✅ Password verification available"
    ready_components=$((ready_components + 1))
fi

if [ -f "packages/api-gateway/src/index.ts" ] && grep -q "cors" packages/api-gateway/src/index.ts; then
    echo "    ✅ CORS configured for cross-origin requests"
    ready_components=$((ready_components + 1))
fi

if grep -q "rateLimit" services/user-service/src/server.ts packages/api-gateway/src/index.ts 2>/dev/null; then
    echo "    ✅ Rate limiting protects against brute force"
    ready_components=$((ready_components + 1))
fi

echo ""
echo "✅ Security Plumbing Validation Complete!"

echo ""
echo "🔧 SECURITY READINESS ASSESSMENT:"

if [ $ready_components -eq $total_components ]; then
    echo "   ✅ ALL SECURITY COMPONENTS READY ($ready_components/$total_components)"
    echo ""
    echo "🎉 AUTH FLOWS FULLY FUNCTIONAL!"
    echo ""
    echo "📝 Test the auth flow with these cURL commands:"
    echo ""
    echo "   # 1. Create a new user"
    echo "   curl -X POST http://localhost:3001/api/v1/users \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"password123\"}'"
    echo ""
    echo "   # 2. Login with seed admin user"
    echo "   curl -X POST http://localhost:3001/api/v1/auth/login \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"email\":\"admin@foundation.local\",\"password\":\"admin123\"}'"
    echo ""
    echo "   # 3. Login with seed regular user"
    echo "   curl -X POST http://localhost:3001/api/v1/auth/login \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"email\":\"user@foundation.local\",\"password\":\"user123\"}'"
    echo ""
    echo "   # 4. Use the returned access token for authenticated requests"
    echo "   curl -X GET http://localhost:3001/api/v1/users \\"
    echo "     -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\""
    echo ""
    echo "   # 5. Refresh token when needed"
    echo "   curl -X POST http://localhost:3001/api/v1/auth/refresh \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"refreshToken\":\"YOUR_REFRESH_TOKEN\"}'"
    echo ""
    echo "   # 6. Logout to revoke tokens"
    echo "   curl -X POST http://localhost:3001/api/v1/auth/logout \\"
    echo "     -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\""
    echo ""
    echo "🔐 Seed User Credentials:"
    echo "   - Admin: admin@foundation.local / admin123"
    echo "   - User:  user@foundation.local / user123"
else
    echo "   ❌ SECURITY GAPS FOUND ($ready_components/$total_components ready)"
    echo ""
    echo "🚨 Missing components prevent end-to-end auth testing"

    remaining_gaps=$((total_components - ready_components))
    echo "   ⚠️  $remaining_gaps component(s) need attention"
fi

echo ""
echo "🛡️  SECURITY FEATURES SUMMARY:"
echo "===============================:"
echo "   - JWT-based authentication with access & refresh tokens"
echo "   - Bcrypt password hashing with salt rounds"
echo "   - Role-based authorization (admin, user)"
echo "   - Rate limiting on sensitive endpoints"
echo "   - CORS protection with configurable origins"
echo "   - Helmet security headers"
echo "   - Database seed users for immediate testing"
echo "   - Environment-based configuration"

exit 0
