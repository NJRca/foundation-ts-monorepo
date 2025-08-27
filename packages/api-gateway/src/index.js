'use strict';
const __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator['throw'](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const __generator = (this && this.__generator) || function (thisArg, body) {
    let _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === 'function' ? Iterator : Object).prototype);
    return g.next = verb(0), g['throw'] = verb(1), g['return'] = verb(2), typeof Symbol === 'function' && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError('Generator is already executing.');
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
const __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, '__esModule', { value: true });
exports.CommonMiddleware = exports.RouteBuilder = exports.ApiGateway = void 0;
const observability_1 = require('@foundation/observability');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// API Gateway class
const ApiGateway = /** @class */ (function () {
    function ApiGateway(config, logger) {
        this.routes = new Map();
        this.middlewareStack = [];
        this.app = express();
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'ApiGateway');
        this.config = config;
        this.setupBaseMiddleware();
    }
    ApiGateway.prototype.setupBaseMiddleware = function () {
        const _this = this;
        // Trust proxy if configured
        if (this.config.security.trustProxy) {
            this.app.set('trust proxy', true);
        }
        // Security middleware
        if (this.config.security.helmet) {
            this.app.use(helmet());
        }
        if (this.config.security.hidePoweredBy) {
            this.app.disable('x-powered-by');
        }
        // CORS configuration
        this.app.use(cors({
            origin: this.config.corsOrigins,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
        }));
        // Parse JSON with size limit
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        // Request context middleware
        this.app.use(this.createRequestContextMiddleware());
        // Compression middleware
        if (this.config.compression) {
            this.app.use(this.createCompressionMiddleware());
        }
        // Global middleware stack
        this.middlewareStack.forEach(function (middleware) {
            _this.app.use(middleware);
        });
    };
    ApiGateway.prototype.createRequestContextMiddleware = function () {
        const _this = this;
        return function (req, res, next) {
            const requestId = req.headers['x-request-id'] || _this.generateRequestId();
            const context = {
                requestId: requestId,
                userId: req.headers['x-user-id'],
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.socket.remoteAddress || 'unknown',
                startTime: new Date(),
                path: req.path,
                method: req.method
            };
            // Attach context to request
            req.context = context;
            // Set response headers
            res.setHeader('X-Request-ID', requestId);
            // Log request
            _this.logger.info(''.concat(req.method, ' ').concat(req.path), {
                requestId: requestId,
                method: req.method,
                path: req.path,
                userAgent: context.userAgent,
                ip: context.ip
            });
            next();
        };
    };
    ApiGateway.prototype.createCompressionMiddleware = function () {
        return function (req, res, next) {
            // Simple compression middleware
            const originalSend = res.send;
            res.send = function (data) {
                if (typeof data === 'string' && data.length > 1024) {
                    res.setHeader('Content-Encoding', 'gzip');
                    // In a real implementation, you'd use a compression library here
                }
                return originalSend.call(this, data);
            };
            next();
        };
    };
    ApiGateway.prototype.generateRequestId = function () {
        return 'req_'.concat(Date.now(), '_').concat(Math.random().toString(36).substring(2, 11));
    };
    // Add global middleware
    ApiGateway.prototype.addMiddleware = function (middleware) {
        this.middlewareStack.push(middleware);
        this.app.use(middleware);
    };
    // Add route
    ApiGateway.prototype.addRoute = function (config) {
        let _a;
        const routeKey = ''.concat(config.method, ':').concat(config.path);
        this.routes.set(routeKey, config);
        const middlewares = [];
        // Add rate limiting if configured
        if (config.rateLimit) {
            middlewares.push(this.createRateLimitMiddleware(config.rateLimit));
        }
        // Add validation if configured
        if (config.validation) {
            middlewares.push(this.createValidationMiddleware(config.validation));
        }
        // Add authentication if required
        if (config.requiresAuth) {
            middlewares.push(this.createAuthMiddleware());
        }
        // Add route-specific middleware
        if (config.middleware) {
            middlewares.push.apply(middlewares, config.middleware);
        }
        // Add error handling wrapper
        middlewares.push(this.createErrorHandlingWrapper(config.handler));
        // Register route with Express
        const method = config.method.toLowerCase();
        (_a = this.app)[method].apply(_a, __spreadArray([config.path], middlewares, false));
        this.logger.info('Registered route: '.concat(config.method, ' ').concat(config.path), {
            method: config.method,
            path: config.path,
            requiresAuth: config.requiresAuth,
            hasRateLimit: !!config.rateLimit,
            hasValidation: !!config.validation
        });
    };
    ApiGateway.prototype.createRateLimitMiddleware = function (config) {
        const requests = new Map();
        return function (req, res, next) {
            const ip = req.ip || 'unknown';
            const now = Date.now();
            const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
            const key = ''.concat(ip, ':').concat(windowStart);
            const current = requests.get(key) || { count: 0, resetTime: windowStart + config.windowMs };
            if (now > current.resetTime) {
                requests.delete(key);
                current.count = 0;
                current.resetTime = windowStart + config.windowMs;
            }
            current.count++;
            requests.set(key, current);
            res.setHeader('X-RateLimit-Limit', config.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current.count));
            res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000));
            if (current.count > config.maxRequests) {
                res.status(429).json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Max '.concat(config.maxRequests, ' requests per ').concat(config.windowMs, 'ms.'),
                    retryAfter: Math.ceil((current.resetTime - now) / 1000)
                });
                return;
            }
            next();
        };
    };
    ApiGateway.prototype.createValidationMiddleware = function (config) {
        return function (req, res, next) {
            const errors = [];
            // Simple validation - in a real implementation, use a library like Joi or Yup
            if (config.body) {
                for (let _i = 0, _a = Object.entries(config.body); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], schema = _b[1];
                    if (!req.body[key] && schema) {
                        errors.push('Missing required field in body: '.concat(key));
                    }
                }
            }
            if (config.query) {
                for (let _c = 0, _d = Object.entries(config.query); _c < _d.length; _c++) {
                    var _e = _d[_c], key = _e[0], schema = _e[1];
                    if (!req.query[key] && schema) {
                        errors.push('Missing required field in query: '.concat(key));
                    }
                }
            }
            if (config.params) {
                for (let _f = 0, _g = Object.entries(config.params); _f < _g.length; _f++) {
                    var _h = _g[_f], key = _h[0], schema = _h[1];
                    if (!req.params[key] && schema) {
                        errors.push('Missing required field in params: '.concat(key));
                    }
                }
            }
            if (errors.length > 0) {
                res.status(400).json({
                    error: 'Validation Error',
                    message: 'Request validation failed',
                    details: errors
                });
                return;
            }
            next();
        };
    };
    ApiGateway.prototype.createAuthMiddleware = function () {
        return function (req, res, next) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Missing Authorization header'
                });
                return;
            }
            // Simple token validation - in a real implementation, verify JWT tokens
            const token = authHeader.replace('Bearer ', '');
            if (!token || token.length < 10) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid token'
                });
                return;
            }
            // Add user info to request context
            req.context.userId = 'user_from_token';
            next();
        };
    };
    ApiGateway.prototype.createErrorHandlingWrapper = function (handler) {
        const _this = this;
        return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
            let error_1, context;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, handler(req, res, next)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        context = req.context;
                        this.logger.error('Route handler error', {
                            requestId: context.requestId,
                            method: req.method,
                            path: req.path,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error',
                            stack: error_1 instanceof Error ? error_1.stack : undefined
                        });
                        if (!res.headersSent) {
                            res.status(500).json({
                                error: 'Internal Server Error',
                                message: 'An unexpected error occurred',
                                requestId: context.requestId
                            });
                        }
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
    };
    // Add health check endpoints
    ApiGateway.prototype.addHealthChecks = function () {
        const _this = this;
        this.addRoute({
            path: '/health',
            method: 'GET',
            handler: function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    res.json({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        version: process.version
                    });
                    return [2 /*return*/];
                });
            }); }
        });
        this.addRoute({
            path: '/health/live',
            method: 'GET',
            handler: function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    res.status(200).send('OK');
                    return [2 /*return*/];
                });
            }); }
        });
        this.addRoute({
            path: '/health/ready',
            method: 'GET',
            handler: function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // Check if all dependencies are ready
                    res.json({ status: 'ready', timestamp: new Date().toISOString() });
                    return [2 /*return*/];
                });
            }); }
        });
    };
    // Start the server
    ApiGateway.prototype.listen = function (port) {
        const _this = this;
        const serverPort = port || this.config.port;
        return new Promise(function (resolve) {
            _this.app.listen(serverPort, function () {
                _this.logger.info('API Gateway listening on port '.concat(serverPort), {
                    port: serverPort,
                    environment: process.env.NODE_ENV || 'development',
                    corsOrigins: _this.config.corsOrigins,
                    routeCount: _this.routes.size
                });
                resolve();
            });
        });
    };
    // Get Express app for testing
    ApiGateway.prototype.getApp = function () {
        return this.app;
    };
    // Get registered routes
    ApiGateway.prototype.getRoutes = function () {
        return new Map(this.routes);
    };
    return ApiGateway;
}());
exports.ApiGateway = ApiGateway;
// Route builder for fluent API
const RouteBuilder = /** @class */ (function () {
    function RouteBuilder() {
        this.config = {};
    }
    RouteBuilder.create = function () {
        return new RouteBuilder();
    };
    RouteBuilder.prototype.path = function (path) {
        this.config.path = path;
        return this;
    };
    RouteBuilder.prototype.method = function (method) {
        this.config.method = method;
        return this;
    };
    RouteBuilder.prototype.get = function (path) {
        this.config.path = path;
        this.config.method = 'GET';
        return this;
    };
    RouteBuilder.prototype.post = function (path) {
        this.config.path = path;
        this.config.method = 'POST';
        return this;
    };
    RouteBuilder.prototype.put = function (path) {
        this.config.path = path;
        this.config.method = 'PUT';
        return this;
    };
    RouteBuilder.prototype.delete = function (path) {
        this.config.path = path;
        this.config.method = 'DELETE';
        return this;
    };
    RouteBuilder.prototype.handler = function (handler) {
        this.config.handler = handler;
        return this;
    };
    RouteBuilder.prototype.middleware = function () {
        const middleware = [];
        for (let _i = 0; _i < arguments.length; _i++) {
            middleware[_i] = arguments[_i];
        }
        this.config.middleware = __spreadArray(__spreadArray([], (this.config.middleware || []), true), middleware, true);
        return this;
    };
    RouteBuilder.prototype.requireAuth = function () {
        this.config.requiresAuth = true;
        return this;
    };
    RouteBuilder.prototype.rateLimit = function (windowMs, maxRequests) {
        this.config.rateLimit = { windowMs: windowMs, maxRequests: maxRequests };
        return this;
    };
    RouteBuilder.prototype.validate = function (validation) {
        this.config.validation = validation;
        return this;
    };
    RouteBuilder.prototype.build = function () {
        if (!this.config.path || !this.config.method || !this.config.handler) {
            throw new Error('Route must have path, method, and handler');
        }
        return this.config;
    };
    return RouteBuilder;
}());
exports.RouteBuilder = RouteBuilder;
// Export common middleware functions
exports.CommonMiddleware = {
    // CORS middleware factory
    cors: function (origins) { return cors({
        origin: origins,
        credentials: true
    }); },
    // JSON parser with size limit
    json: function (limit) {
        if (limit === void 0) { limit = '10mb'; }
        return express.json({ limit: limit });
    },
    // URL encoded parser
    urlencoded: function (limit) {
        if (limit === void 0) { limit = '10mb'; }
        return express.urlencoded({ extended: true, limit: limit });
    },
    // Request logging middleware
    requestLogger: function (logger) {
        return function (req, res, next) {
            const start = Date.now();
            const originalSend = res.send;
            res.send = function (data) {
                const duration = Date.now() - start;
                const context = req.context;
                logger.info(''.concat(req.method, ' ').concat(req.path, ' - ').concat(res.statusCode), {
                    requestId: context === null || context === void 0 ? void 0 : context.requestId,
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    duration: duration,
                    contentLength: res.get('content-length'),
                    userAgent: req.headers['user-agent']
                });
                return originalSend.call(this, data);
            };
            next();
        };
    },
    // Error handling middleware
    errorHandler: function (logger) {
        return function (error, req, res, next) {
            const context = req.context;
            logger.error('Unhandled error in middleware', {
                requestId: context === null || context === void 0 ? void 0 : context.requestId,
                method: req.method,
                path: req.path,
                error: error.message,
                stack: error.stack
            });
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'An unexpected error occurred',
                    requestId: context === null || context === void 0 ? void 0 : context.requestId
                });
            }
        };
    }
};
