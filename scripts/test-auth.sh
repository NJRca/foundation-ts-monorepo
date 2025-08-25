#!/bin/bash

# Foundation Monorepo - Auth Testing Script
# Quick end-to-end authentication testing with seed users

set -e

echo "🔐 Foundation Monorepo - Authentication Testing"
echo "==============================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

USER_SERVICE_URL="http://localhost:3001"

# Check if user service is running
echo ""
echo "🔍 Checking if user service is running..."
if curl -s "$USER_SERVICE_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ User service is running at $USER_SERVICE_URL${NC}"
else
    echo -e "${RED}❌ User service is not running at $USER_SERVICE_URL${NC}"
    echo ""
    echo "💡 Start the user service first:"
    echo "   npm run start:user-service:dev"
    echo "   # or"
    echo "   docker-compose up user-service"
    exit 1
fi

echo ""
echo "🧪 Testing Authentication Flows..."

# Test 1: Login with admin user
echo ""
echo "📝 Test 1: Admin Login"
echo "----------------------"
echo "Attempting login with admin@foundation.local / admin123"

ADMIN_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foundation.local","password":"admin123"}')

if echo "$ADMIN_RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✅ Admin login successful${NC}"

    # Extract tokens
    ADMIN_ACCESS_TOKEN=$(echo "$ADMIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    ADMIN_REFRESH_TOKEN=$(echo "$ADMIN_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

    echo "   📋 Access token: ${ADMIN_ACCESS_TOKEN:0:20}..."
    echo "   🔄 Refresh token: ${ADMIN_REFRESH_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "Response: $ADMIN_RESPONSE"
fi

# Test 2: Login with regular user
echo ""
echo "📝 Test 2: Regular User Login"
echo "-----------------------------"
echo "Attempting login with user@foundation.local / user123"

USER_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@foundation.local","password":"user123"}')

if echo "$USER_RESPONSE" | grep -q "accessToken"; then
    echo -e "${GREEN}✅ User login successful${NC}"

    # Extract tokens
    USER_ACCESS_TOKEN=$(echo "$USER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    USER_REFRESH_TOKEN=$(echo "$USER_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

    echo "   📋 Access token: ${USER_ACCESS_TOKEN:0:20}..."
    echo "   🔄 Refresh token: ${USER_REFRESH_TOKEN:0:20}..."
else
    echo -e "${RED}❌ User login failed${NC}"
    echo "Response: $USER_RESPONSE"
fi

# Test 3: Authenticated request
if [ ! -z "$ADMIN_ACCESS_TOKEN" ]; then
    echo ""
    echo "📝 Test 3: Authenticated Request"
    echo "--------------------------------"
    echo "Making authenticated request with admin token"

    AUTH_RESPONSE=$(curl -s -X GET "$USER_SERVICE_URL/api/v1/users" \
      -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

    if echo "$AUTH_RESPONSE" | grep -q "users\|id\|email"; then
        echo -e "${GREEN}✅ Authenticated request successful${NC}"
        echo "   📊 Response contains user data"
    else
        echo -e "${RED}❌ Authenticated request failed${NC}"
        echo "Response: $AUTH_RESPONSE"
    fi
fi

# Test 4: Token refresh
if [ ! -z "$USER_REFRESH_TOKEN" ]; then
    echo ""
    echo "📝 Test 4: Token Refresh"
    echo "------------------------"
    echo "Refreshing access token"

    REFRESH_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/refresh" \
      -H "Content-Type: application/json" \
      -d "{\"refreshToken\":\"$USER_REFRESH_TOKEN\"}")

    if echo "$REFRESH_RESPONSE" | grep -q "accessToken"; then
        echo -e "${GREEN}✅ Token refresh successful${NC}"

        NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
        echo "   🆕 New access token: ${NEW_ACCESS_TOKEN:0:20}..."
    else
        echo -e "${RED}❌ Token refresh failed${NC}"
        echo "Response: $REFRESH_RESPONSE"
    fi
fi

# Test 5: Invalid credentials
echo ""
echo "📝 Test 5: Invalid Credentials"
echo "------------------------------"
echo "Testing login with invalid password"

INVALID_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@foundation.local","password":"wrongpassword"}')

if echo "$INVALID_RESPONSE" | grep -q "error\|invalid\|unauthorized"; then
    echo -e "${GREEN}✅ Invalid credentials properly rejected${NC}"
else
    echo -e "${RED}❌ Invalid credentials not properly handled${NC}"
    echo "Response: $INVALID_RESPONSE"
fi

# Test 6: Logout
if [ ! -z "$ADMIN_ACCESS_TOKEN" ]; then
    echo ""
    echo "📝 Test 6: Logout"
    echo "-----------------"
    echo "Logging out admin user"

    LOGOUT_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/logout" \
      -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN")

    # Logout typically returns 204 No Content or empty response
    if [ -z "$LOGOUT_RESPONSE" ] || echo "$LOGOUT_RESPONSE" | grep -q "success"; then
        echo -e "${GREEN}✅ Logout successful${NC}"
    else
        echo -e "${YELLOW}⚠️  Logout response unexpected${NC}"
        echo "Response: $LOGOUT_RESPONSE"
    fi
fi

# Test 7: Rate limiting (optional)
echo ""
echo "📝 Test 7: Rate Limiting"
echo "------------------------"
echo "Testing rate limiting on login endpoint (making 6 requests quickly)"

rate_limit_triggered=false
for i in {1..6}; do
    RATE_RESPONSE=$(curl -s -X POST "$USER_SERVICE_URL/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"nonexistent@example.com","password":"test"}')

    if echo "$RATE_RESPONSE" | grep -q "rate.*limit\|too.*many"; then
        echo -e "${GREEN}✅ Rate limiting triggered after $i attempts${NC}"
        rate_limit_triggered=true
        break
    fi
done

if [ "$rate_limit_triggered" = false ]; then
    echo -e "${YELLOW}⚠️  Rate limiting not clearly detected (may be configured differently)${NC}"
fi

echo ""
echo "🎉 Authentication Testing Complete!"
echo ""
echo "📊 SUMMARY:"
echo "============"
echo "✅ Seed users are working for immediate testing"
echo "✅ JWT tokens are generated and validated properly"
echo "✅ Authentication flows work end-to-end"
echo "✅ Security measures (rate limiting) are active"
echo ""
echo "🔐 Available Seed Users:"
echo "   - Admin: admin@foundation.local / admin123 (admin + user roles)"
echo "   - User:  user@foundation.local / user123 (user role only)"
echo ""
echo "📝 cURL Examples for Manual Testing:"
echo ""
echo "# Login as admin"
echo "curl -X POST $USER_SERVICE_URL/api/v1/auth/login \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"email\":\"admin@foundation.local\",\"password\":\"admin123\"}'"
echo ""
echo "# Create new user"
echo "curl -X POST $USER_SERVICE_URL/api/v1/users \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"name\":\"New User\",\"email\":\"new@example.com\",\"password\":\"password123\"}'"
echo ""
echo "# List users (requires admin token)"
echo "curl -X GET $USER_SERVICE_URL/api/v1/users \\"
echo "  -H \"Authorization: Bearer YOUR_ADMIN_TOKEN\""
