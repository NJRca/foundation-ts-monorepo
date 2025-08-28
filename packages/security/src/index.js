/* eslint-disable no-var, no-const-assign, no-sparse-arrays, no-unreachable, no-useless-escape, no-process-env */
'use strict';
const __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (let s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (const p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (const p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
const __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
const __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    let _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create((typeof Iterator === 'function' ? Iterator : Object).prototype);
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.AuthMiddleware =
  exports.SecurityUtils =
  exports.AuthorizationService =
  exports.AuthenticationService =
    void 0;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto_1 = require('crypto');
const observability_1 = require('@foundation/observability');
// Authentication service
const AuthenticationService = /** @class */ (function () {
  function AuthenticationService(config, logger) {
    this.sessions = new Map();
    this.blacklistedTokens = new Set();
    this.logger = logger || (0, observability_1.createLogger)(false, 0, 'AuthenticationService');
    this.jwtSecret = config.jwtSecret;
    this.jwtRefreshSecret = config.jwtRefreshSecret;
    this.saltRounds = config.saltRounds || 12;
    this.accessTokenTtl = config.accessTokenTtl || 3600; // 1 hour
    this.refreshTokenTtl = config.refreshTokenTtl || 604800; // 7 days
  }
  AuthenticationService.prototype.hashPassword = function (password) {
    return __awaiter(this, void 0, void 0, function () {
      let hash, error_1;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [4 /*yield*/, bcrypt.hash(password, this.saltRounds)];
          case 1:
            hash = _a.sent();
            this.logger.debug('Password hashed successfully');
            return [2 /*return*/, hash];
          case 2:
            error_1 = _a.sent();
            this.logger.error('Password hashing failed', {
              error: error_1 instanceof Error ? error_1.message : 'Unknown error',
            });
            throw new Error('Password hashing failed');
          case 3:
            return [2 /*return*/];
        }
      });
    });
  };
  AuthenticationService.prototype.verifyPassword = function (password, hash) {
    return __awaiter(this, void 0, void 0, function () {
      let isValid, error_2;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [4 /*yield*/, bcrypt.compare(password, hash)];
          case 1:
            isValid = _a.sent();
            this.logger.debug('Password verification completed', { isValid: isValid });
            return [2 /*return*/, isValid];
          case 2:
            error_2 = _a.sent();
            this.logger.error('Password verification failed', {
              error: error_2 instanceof Error ? error_2.message : 'Unknown error',
            });
            throw new Error('Password verification failed');
          case 3:
            return [2 /*return*/];
        }
      });
    });
  };
  AuthenticationService.prototype.generateTokens = function (user) {
    return __awaiter(this, void 0, void 0, function () {
      let sessionId, now, sessionData, accessPayload, refreshPayload, accessToken, refreshToken;
      return __generator(this, function (_a) {
        sessionId = this.generateSessionId();
        now = Math.floor(Date.now() / 1000);
        sessionData = {
          userId: user.id,
          email: user.email,
          roles: user.roles,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          tokenVersion: 1,
        };
        this.sessions.set(sessionId, sessionData);
        accessPayload = {
          userId: user.id,
          email: user.email,
          roles: user.roles,
          sessionId: sessionId,
          iat: now,
          exp: now + this.accessTokenTtl,
        };
        refreshPayload = {
          userId: user.id,
          sessionId: sessionId,
          tokenVersion: sessionData.tokenVersion,
          iat: now,
          exp: now + this.refreshTokenTtl,
        };
        try {
          accessToken = jwt.sign(accessPayload, this.jwtSecret, {
            algorithm: 'HS256',
          });
          refreshToken = jwt.sign(refreshPayload, this.jwtRefreshSecret, {
            algorithm: 'HS256',
          });
          this.logger.info('Tokens generated successfully', {
            userId: user.id,
            sessionId: sessionId,
            expiresIn: this.accessTokenTtl,
          });
          return [
            2 /*return*/,
            {
              accessToken: accessToken,
              refreshToken: refreshToken,
              expiresIn: this.accessTokenTtl,
              tokenType: 'Bearer',
            },
          ];
        } catch (error) {
          this.logger.error('Token generation failed', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw new Error('Token generation failed');
        }
        return [2 /*return*/];
      });
    });
  };
  AuthenticationService.prototype.verifyAccessToken = function (token) {
    return __awaiter(this, void 0, void 0, function () {
      let payload, session;
      return __generator(this, function (_a) {
        if (this.blacklistedTokens.has(token)) {
          this.logger.warn('Attempt to use blacklisted token');
          return [2 /*return*/, null];
        }
        try {
          payload = jwt.verify(token, this.jwtSecret);
          session = this.sessions.get(payload.sessionId);
          if (!session) {
            this.logger.warn('Token references non-existent session', {
              sessionId: payload.sessionId,
            });
            return [2 /*return*/, null];
          }
          // Update session last accessed time
          session.lastAccessedAt = new Date();
          this.logger.debug('Access token verified successfully', {
            userId: payload.userId,
            sessionId: payload.sessionId,
          });
          return [2 /*return*/, payload];
        } catch (error) {
          this.logger.warn('Access token verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return [2 /*return*/, null];
        }
        return [2 /*return*/];
      });
    });
  };
  AuthenticationService.prototype.refreshAccessToken = function (refreshToken) {
    return __awaiter(this, void 0, void 0, function () {
      let payload, session, user, newTokens, error_3;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            payload = jwt.verify(refreshToken, this.jwtRefreshSecret);
            session = this.sessions.get(payload.sessionId);
            if (!session || session.tokenVersion !== payload.tokenVersion) {
              this.logger.warn('Refresh token references invalid session', {
                sessionId: payload.sessionId,
                expectedVersion:
                  session === null || session === void 0 ? void 0 : session.tokenVersion,
                providedVersion: payload.tokenVersion,
              });
              return [2 /*return*/, null];
            }
            user = {
              id: session.userId,
              email: session.email,
              roles: session.roles,
              passwordHash: '', // Not needed for token generation
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            // Increment token version to invalidate old refresh tokens
            session.tokenVersion++;
            return [4 /*yield*/, this.generateTokens(user)];
          case 1:
            newTokens = _a.sent();
            this.logger.info('Access token refreshed successfully', {
              userId: session.userId,
              sessionId: payload.sessionId,
            });
            return [2 /*return*/, newTokens];
          case 2:
            error_3 = _a.sent();
            this.logger.warn('Refresh token verification failed', {
              error: error_3 instanceof Error ? error_3.message : 'Unknown error',
            });
            return [2 /*return*/, null];
          case 3:
            return [2 /*return*/];
        }
      });
    });
  };
  AuthenticationService.prototype.revokeToken = function (token) {
    return __awaiter(this, void 0, void 0, function () {
      let payload;
      return __generator(this, function (_a) {
        this.blacklistedTokens.add(token);
        try {
          payload = jwt.decode(token);
          if (payload === null || payload === void 0 ? void 0 : payload.sessionId) {
            this.sessions.delete(payload.sessionId);
            this.logger.info('Token and session revoked', {
              sessionId: payload.sessionId,
              userId: payload.userId,
            });
          }
        } catch (error) {
          this.logger.warn('Error during token revocation', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        return [2 /*return*/];
      });
    });
  };
  AuthenticationService.prototype.revokeAllUserTokens = function (userId) {
    return __awaiter(this, void 0, void 0, function () {
      let sessionsToRemove, _i, sessionsToRemove_1, sessionId;
      return __generator(this, function (_a) {
        sessionsToRemove = [];
        Array.from(this.sessions.entries()).forEach(function (_a) {
          const sessionId = _a[0],
            session = _a[1];
          if (session.userId === userId) {
            sessionsToRemove.push(sessionId);
          }
        });
        for (_i = 0, sessionsToRemove_1 = sessionsToRemove; _i < sessionsToRemove_1.length; _i++) {
          sessionId = sessionsToRemove_1[_i];
          this.sessions.delete(sessionId);
        }
        this.logger.info('All user sessions revoked', {
          userId: userId,
          sessionCount: sessionsToRemove.length,
        });
        return [2 /*return*/];
      });
    });
  };
  AuthenticationService.prototype.generateSessionId = function () {
    return (0, crypto_1.randomBytes)(32).toString('hex');
  };
  // Session management
  AuthenticationService.prototype.getActiveSessions = function (userId) {
    const userSessions = [];
    Array.from(this.sessions.entries()).forEach(function (_a) {
      const sessionId = _a[0],
        session = _a[1];
      if (session.userId === userId) {
        userSessions.push({
          sessionId: sessionId,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
        });
      }
    });
    return userSessions;
  };
  AuthenticationService.prototype.cleanupExpiredSessions = function () {
    return __awaiter(this, void 0, void 0, function () {
      let now, expiredSessions, _i, expiredSessions_1, sessionId;
      const _this = this;
      return __generator(this, function (_a) {
        now = new Date();
        expiredSessions = [];
        Array.from(this.sessions.entries()).forEach(function (_a) {
          const sessionId = _a[0],
            session = _a[1];
          const sessionAge = now.getTime() - session.lastAccessedAt.getTime();
          if (sessionAge > _this.refreshTokenTtl * 1000) {
            expiredSessions.push(sessionId);
          }
        });
        for (_i = 0, expiredSessions_1 = expiredSessions; _i < expiredSessions_1.length; _i++) {
          sessionId = expiredSessions_1[_i];
          this.sessions.delete(sessionId);
        }
        if (expiredSessions.length > 0) {
          this.logger.info('Cleaned up expired sessions', {
            expiredCount: expiredSessions.length,
          });
        }
        return [2 /*return*/];
      });
    });
  };
  return AuthenticationService;
})();
exports.AuthenticationService = AuthenticationService;
// Authorization service
const AuthorizationService = /** @class */ (function () {
  function AuthorizationService(logger) {
    this.roles = new Map();
    this.logger = logger || (0, observability_1.createLogger)(false, 0, 'AuthorizationService');
  }
  AuthorizationService.prototype.addRole = function (role) {
    this.roles.set(role.name, role);
    this.logger.debug('Role added', {
      roleName: role.name,
      permissionCount: role.permissions.length,
    });
  };
  AuthorizationService.prototype.hasPermission = function (userRoles, resource, action, context) {
    for (let _i = 0, userRoles_1 = userRoles; _i < userRoles_1.length; _i++) {
      const roleName = userRoles_1[_i];
      const role = this.roles.get(roleName);
      if (!role) {
        this.logger.warn('Unknown role referenced', { roleName: roleName });
        continue;
      }
      for (let _a = 0, _b = role.permissions; _a < _b.length; _a++) {
        const permission = _b[_a];
        if (this.matchesPermission(permission, resource, action, context)) {
          this.logger.debug('Permission granted', {
            roleName: roleName,
            resource: resource,
            action: action,
            permission: permission,
          });
          return true;
        }
      }
    }
    this.logger.debug('Permission denied', {
      userRoles: userRoles,
      resource: resource,
      action: action,
    });
    return false;
  };
  AuthorizationService.prototype.matchesPermission = function (
    permission,
    resource,
    action,
    context
  ) {
    // Check resource match (support wildcards)
    if (!this.matchesPattern(permission.resource, resource)) {
      return false;
    }
    // Check action match (support wildcards)
    if (!this.matchesPattern(permission.action, action)) {
      return false;
    }
    // Check conditions if present
    if (permission.conditions && context) {
      for (let _i = 0, _a = Object.entries(permission.conditions); _i < _a.length; _i++) {
        const _b = _a[_i],
          key = _b[0],
          expectedValue = _b[1];
        const actualValue = context[key];
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }
    return true;
  };
  AuthorizationService.prototype.matchesPattern = function (pattern, value) {
    if (pattern === '*') return true;
    if (pattern === value) return true;
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(value);
    }
    return false;
  };
  AuthorizationService.prototype.getUserPermissions = function (userRoles) {
    const permissions = [];
    for (let _i = 0, userRoles_2 = userRoles; _i < userRoles_2.length; _i++) {
      const roleName = userRoles_2[_i];
      const role = this.roles.get(roleName);
      if (role) {
        permissions.push.apply(permissions, role.permissions);
      }
    }
    return permissions;
  };
  return AuthorizationService;
})();
exports.AuthorizationService = AuthorizationService;
// Security utilities
const SecurityUtils = /** @class */ (function () {
  function SecurityUtils() {}
  SecurityUtils.generateSecureToken = function (length) {
    if (length === void 0) {
      length = 32;
    }
    return (0, crypto_1.randomBytes)(length).toString('hex');
  };
  SecurityUtils.generateApiKey = function () {
    const prefix = 'ak_';
    const random = (0, crypto_1.randomBytes)(24).toString('hex');
    return prefix + random;
  };
  SecurityUtils.hashApiKey = function (apiKey) {
    return (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex');
  };
  SecurityUtils.verifyApiKey = function (apiKey, hash) {
    const computedHash = this.hashApiKey(apiKey);
    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(computedHash, 'hex');
    if (expected.length !== actual.length) {
      return false;
    }
    return (0, crypto_1.timingSafeEqual)(expected, actual);
  };
  SecurityUtils.sanitizeInput = function (input) {
    return input
      .replace(/[<>\"']/g, '') // Remove HTML/script injection chars
      .replace(/[\\\/]/g, '') // Remove path traversal chars
      .trim();
  };
  SecurityUtils.isStrongPassword = function (password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?\":{}|<>]/.test(password);
    return (
      password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar
    );
  };
  SecurityUtils.validateEmail = function (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  SecurityUtils.rateLimit = function (identifier, windowMs, maxRequests) {
    const _this = this;
    // Simple in-memory rate limiting (in production, use Redis)
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = ''.concat(identifier, ':').concat(windowStart);
    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, 0);
    }
    const count = this.rateLimitStore.get(key) + 1;
    this.rateLimitStore.set(key, count);
    // Clean up old entries
    Array.from(this.rateLimitStore.keys()).forEach(function (storeKey) {
      const keyTime = parseInt(storeKey.split(':')[1]);
      if (keyTime < windowStart) {
        _this.rateLimitStore.delete(storeKey);
      }
    });
    return count <= maxRequests;
  };
  SecurityUtils.logger = (0, observability_1.createLogger)(false, 0, 'SecurityUtils');
  SecurityUtils.rateLimitStore = new Map();
  return SecurityUtils;
})();
exports.SecurityUtils = SecurityUtils;
// Authentication middleware for Express
const AuthMiddleware = /** @class */ (function () {
  function AuthMiddleware(authService, authzService, logger) {
    this.authService = authService;
    this.authzService = authzService;
    this.logger = logger || (0, observability_1.createLogger)(false, 0, 'AuthMiddleware');
  }
  AuthMiddleware.prototype.authenticate = function () {
    const _this = this;
    return function (req, res, next) {
      return __awaiter(_this, void 0, void 0, function () {
        let authHeader, token, payload;
        return __generator(this, function (_a) {
          switch (_a.label) {
            case 0:
              authHeader = req.headers.authorization;
              if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                  error: 'Unauthorized',
                  message: 'Missing or invalid authorization header',
                });
                return [2 /*return*/];
              }
              token = authHeader.substring(7);
              return [4 /*yield*/, this.authService.verifyAccessToken(token)];
            case 1:
              payload = _a.sent();
              if (!payload) {
                res.status(401).json({
                  error: 'Unauthorized',
                  message: 'Invalid or expired token',
                });
                return [2 /*return*/];
              }
              // Attach user info to request
              req.user = {
                id: payload.userId,
                email: payload.email,
                roles: payload.roles,
                sessionId: payload.sessionId,
              };
              next();
              return [2 /*return*/];
          }
        });
      });
    };
  };
  AuthMiddleware.prototype.authorize = function (resource, action) {
    const _this = this;
    return function (req, res, next) {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }
      const hasPermission = _this.authzService.hasPermission(
        req.user.roles,
        resource,
        action,
        __assign(__assign({ userId: req.user.id }, req.params), req.query)
      );
      if (!hasPermission) {
        _this.logger.warn('Authorization failed', {
          userId: req.user.id,
          resource: resource,
          action: action,
          userRoles: req.user.roles,
        });
        res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
        return;
      }
      next();
    };
  };
  return AuthMiddleware;
})();
exports.AuthMiddleware = AuthMiddleware;
// Export all types and classes
__exportStar(require('@foundation/contracts'), exports);
