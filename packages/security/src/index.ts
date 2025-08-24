import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Authentication interfaces
import { User as BaseUser } from '@foundation/database';
import { Logger } from '@foundation/contracts';
import { createLogger } from '@foundation/observability';

export interface User extends BaseUser {
  passwordHash: string;
  roles: string[];
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  description?: string;
}

// Authentication service
export class AuthenticationService {
  private readonly logger: Logger;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly saltRounds: number;
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly sessions: Map<string, SessionData> = new Map();
  private readonly blacklistedTokens: Set<string> = new Set();

  constructor(config: {
    jwtSecret: string;
    jwtRefreshSecret: string;
    saltRounds?: number;
    accessTokenTtl?: number; // seconds
    refreshTokenTtl?: number; // seconds
  }, logger?: Logger) {
    this.logger = logger || createLogger(false, 0, 'AuthenticationService');
    this.jwtSecret = config.jwtSecret;
    this.jwtRefreshSecret = config.jwtRefreshSecret;
    this.saltRounds = config.saltRounds || 12;
    this.accessTokenTtl = config.accessTokenTtl || 3600; // 1 hour
    this.refreshTokenTtl = config.refreshTokenTtl || 604800; // 7 days
  }

  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      this.logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      this.logger.error('Password hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Password hashing failed');
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      this.logger.debug('Password verification completed', { isValid });
      return isValid;
    } catch (error) {
      this.logger.error('Password verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Password verification failed');
    }
  }

  async generateTokens(user: User): Promise<AuthToken> {
    const sessionId = this.generateSessionId();
    const now = Math.floor(Date.now() / 1000);

    // Create session
    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      tokenVersion: 1
    };
    this.sessions.set(sessionId, sessionData);

    // Generate access token
    const accessPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      sessionId,
      iat: now,
      exp: now + this.accessTokenTtl
    };

    // Generate refresh token
    const refreshPayload: RefreshTokenPayload = {
      userId: user.id,
      sessionId,
      tokenVersion: sessionData.tokenVersion,
      iat: now,
      exp: now + this.refreshTokenTtl
    };

    try {
      const accessToken = jwt.sign(accessPayload, this.jwtSecret, {
        algorithm: 'HS256'
      });

      const refreshToken = jwt.sign(refreshPayload, this.jwtRefreshSecret, {
        algorithm: 'HS256'
      });

      this.logger.info('Tokens generated successfully', {
        userId: user.id,
        sessionId,
        expiresIn: this.accessTokenTtl
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenTtl,
        tokenType: 'Bearer'
      };
    } catch (error) {
      this.logger.error('Token generation failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Token generation failed');
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    if (this.blacklistedTokens.has(token)) {
      this.logger.warn('Attempt to use blacklisted token');
      return null;
    }

    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      
      // Check if session exists
      const session = this.sessions.get(payload.sessionId);
      if (!session) {
        this.logger.warn('Token references non-existent session', {
          sessionId: payload.sessionId
        });
        return null;
      }

      // Update session last accessed time
      session.lastAccessedAt = new Date();

      this.logger.debug('Access token verified successfully', {
        userId: payload.userId,
        sessionId: payload.sessionId
      });

      return payload;
    } catch (error) {
      this.logger.warn('Access token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthToken | null> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as RefreshTokenPayload;
      
      // Check if session exists and token version matches
      const session = this.sessions.get(payload.sessionId);
      if (!session || session.tokenVersion !== payload.tokenVersion) {
        this.logger.warn('Refresh token references invalid session', {
          sessionId: payload.sessionId,
          expectedVersion: session?.tokenVersion,
          providedVersion: payload.tokenVersion
        });
        return null;
      }

      // Generate new tokens
      const user: User = {
        id: session.userId,
        name: session.email.split('@')[0], // Default name from email
        email: session.email,
        roles: session.roles,
        passwordHash: '', // Not needed for token generation
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Increment token version to invalidate old refresh tokens
      session.tokenVersion++;
      
      const newTokens = await this.generateTokens(user);

      this.logger.info('Access token refreshed successfully', {
        userId: session.userId,
        sessionId: payload.sessionId
      });

      return newTokens;
    } catch (error) {
      this.logger.warn('Refresh token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async revokeToken(token: string): Promise<void> {
    this.blacklistedTokens.add(token);
    
    try {
      const payload = jwt.decode(token) as TokenPayload;
      if (payload?.sessionId) {
        this.sessions.delete(payload.sessionId);
        this.logger.info('Token and session revoked', {
          sessionId: payload.sessionId,
          userId: payload.userId
        });
      }
    } catch (error) {
      this.logger.warn('Error during token revocation', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const sessionsToRemove: string[] = [];
    
    Array.from(this.sessions.entries()).forEach(([sessionId, session]) => {
      if (session.userId === userId) {
        sessionsToRemove.push(sessionId);
      }
    });

    for (const sessionId of sessionsToRemove) {
      this.sessions.delete(sessionId);
    }

    this.logger.info('All user sessions revoked', {
      userId,
      sessionCount: sessionsToRemove.length
    });
  }

  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  // Session management
  getActiveSessions(userId: string): SessionInfo[] {
    const userSessions: SessionInfo[] = [];
    
    Array.from(this.sessions.entries()).forEach(([sessionId, session]) => {
      if (session.userId === userId) {
        userSessions.push({
          sessionId,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt
        });
      }
    });

    return userSessions;
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    Array.from(this.sessions.entries()).forEach(([sessionId, session]) => {
      const sessionAge = now.getTime() - session.lastAccessedAt.getTime();
      if (sessionAge > this.refreshTokenTtl * 1000) {
        expiredSessions.push(sessionId);
      }
    });

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info('Cleaned up expired sessions', {
        expiredCount: expiredSessions.length
      });
    }
  }
}

// Authorization service
export class AuthorizationService {
  private readonly logger: Logger;
  private readonly roles: Map<string, Role> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || createLogger(false, 0, 'AuthorizationService');
  }

  addRole(role: Role): void {
    this.roles.set(role.name, role);
    this.logger.debug('Role added', {
      roleName: role.name,
      permissionCount: role.permissions.length
    });
  }

  hasPermission(userRoles: string[], resource: string, action: string, context?: Record<string, any>): boolean {
    for (const roleName of userRoles) {
      const role = this.roles.get(roleName);
      if (!role) {
        this.logger.warn('Unknown role referenced', { roleName });
        continue;
      }

      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          this.logger.debug('Permission granted', {
            roleName,
            resource,
            action,
            permission
          });
          return true;
        }
      }
    }

    this.logger.debug('Permission denied', {
      userRoles,
      resource,
      action
    });
    return false;
  }

  private matchesPermission(permission: Permission, resource: string, action: string, context?: Record<string, any>): boolean {
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
      for (const [key, expectedValue] of Object.entries(permission.conditions)) {
        const actualValue = context[key];
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;
    
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(value);
    }

    return false;
  }

  getUserPermissions(userRoles: string[]): Permission[] {
    const permissions: Permission[] = [];
    
    for (const roleName of userRoles) {
      const role = this.roles.get(roleName);
      if (role) {
        permissions.push(...role.permissions);
      }
    }

    return permissions;
  }
}

// Security utilities
export class SecurityUtils {
  private static readonly logger = createLogger(false, 0, 'SecurityUtils');

  static generateSecureToken(length = 32): string {
    return randomBytes(length).toString('hex');
  }

  static generateApiKey(): string {
    const prefix = 'ak_';
    const random = randomBytes(24).toString('hex');
    return prefix + random;
  }

  static hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  static verifyApiKey(apiKey: string, hash: string): boolean {
    const computedHash = this.hashApiKey(apiKey);
    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(computedHash, 'hex');
    
    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }

  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>"']/g, '') // Remove HTML/script injection chars
      .replace(/[\\/]/g, '') // Remove path traversal chars
      .trim();
  }

  static isStrongPassword(password: string): boolean {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static rateLimit(identifier: string, windowMs: number, maxRequests: number): boolean {
    // Simple in-memory rate limiting (in production, use Redis)
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const key = `${identifier}:${windowStart}`;

    if (!this.rateLimitStore.has(key)) {
      this.rateLimitStore.set(key, 0);
    }

    const count = this.rateLimitStore.get(key)! + 1;
    this.rateLimitStore.set(key, count);

    // Clean up old entries
    Array.from(this.rateLimitStore.keys()).forEach(storeKey => {
      const keyTime = parseInt(storeKey.split(':')[1]);
      if (keyTime < windowStart) {
        this.rateLimitStore.delete(storeKey);
      }
    });

    return count <= maxRequests;
  }

  private static readonly rateLimitStore = new Map<string, number>();
}

// Authentication middleware for Express
export class AuthMiddleware {
  private readonly authService: AuthenticationService;
  private readonly authzService: AuthorizationService;
  private readonly logger: Logger;

  constructor(
    authService: AuthenticationService,
    authzService: AuthorizationService,
    logger?: Logger
  ) {
    this.authService = authService;
    this.authzService = authzService;
    this.logger = logger || createLogger(false, 0, 'AuthMiddleware');
  }

  authenticate() {
    return async (req: any, res: any, next: any): Promise<void> => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header'
        });
        return;
      }

      const token = authHeader.substring(7);
      const payload = await this.authService.verifyAccessToken(token);

      if (!payload) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
        return;
      }

      // Attach user info to request
      req.user = {
        id: payload.userId,
        email: payload.email,
        roles: payload.roles,
        sessionId: payload.sessionId
      };

      next();
    };
  }

  authorize(resource: string, action: string) {
    return (req: any, res: any, next: any): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
        return;
      }

      const hasPermission = this.authzService.hasPermission(
        req.user.roles,
        resource,
        action,
        { userId: req.user.id, ...req.params, ...req.query }
      );

      if (!hasPermission) {
        this.logger.warn('Authorization failed', {
          userId: req.user.id,
          resource,
          action,
          userRoles: req.user.roles
        });

        res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions'
        });
        return;
      }

      next();
    };
  }
}

// Supporting interfaces
interface SessionData {
  userId: string;
  email: string;
  roles: string[];
  createdAt: Date;
  lastAccessedAt: Date;
  tokenVersion: number;
}

interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

// Export all types and classes
export * from '@foundation/contracts';
