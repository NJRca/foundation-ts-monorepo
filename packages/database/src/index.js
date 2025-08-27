'use strict';
const __extends = (this && this.__extends) || (function () {
    let extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (const p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== 'function' && b !== null)
            throw new TypeError('Class extends value ' + String(b) + ' is not a constructor or null');
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, '__esModule', { value: true });
exports.CacheHealthCheck = exports.DatabaseHealthCheck = exports.MigrationRunner = exports.UserRepository = exports.BaseRepository = exports.RedisCache = exports.PostgresConnection = void 0;
const pg_1 = require('pg');
const redis_1 = require('redis');
const observability_1 = require('@foundation/observability');
// PostgreSQL connection implementation
const PostgresConnection = /** @class */ (function () {
    function PostgresConnection(config, logger) {
        const _this = this;
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'PostgresConnection');
        this.pool = new pg_1.Pool({
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.username,
            password: config.password,
            max: config.maxConnections || 10,
            idleTimeoutMillis: config.idleTimeoutMs || 30000,
            connectionTimeoutMillis: config.connectionTimeoutMs || 2000,
        });
        this.pool.on('error', function (err) {
            _this.logger.error('PostgreSQL pool error', { error: err.message });
        });
        this.pool.on('connect', function () {
            _this.logger.debug('New PostgreSQL client connected');
        });
    }
    PostgresConnection.prototype.query = function (text, params) {
        return __awaiter(this, void 0, void 0, function () {
            var start, result, duration, error_1, duration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        start = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this.logger.debug('Executing query', { query: text, params: params });
                        return [4 /*yield*/, this.pool.query(text, params)];
                    case 2:
                        result = _a.sent();
                        duration = Date.now() - start;
                        this.logger.debug('Query completed', {
                            query: text,
                            duration: duration,
                            rowCount: result.rowCount
                        });
                        return [2 /*return*/, result];
                    case 3:
                        error_1 = _a.sent();
                        duration = Date.now() - start;
                        this.logger.error('Query failed', {
                            query: text,
                            params: params,
                            duration: duration,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        });
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PostgresConnection.prototype.transaction = function (callback) {
        return __awaiter(this, void 0, void 0, function () {
            let client, transactionClient, result, error_2;
            const _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.connect()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, 8, 9]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        transactionClient = {
                            query: function (text, params) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, client.query(text, params)];
                                });
                            }); },
                            commit: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, client.query('COMMIT')];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); },
                            rollback: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, client.query('ROLLBACK')];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }
                        };
                        return [4 /*yield*/, callback(transactionClient)];
                    case 4:
                        result = _a.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 5:
                        _a.sent();
                        this.logger.debug('Transaction completed successfully');
                        return [2 /*return*/, result];
                    case 6:
                        error_2 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 7:
                        _a.sent();
                        this.logger.error('Transaction failed, rolled back', {
                            error: error_2 instanceof Error ? error_2.message : 'Unknown error'
                        });
                        throw error_2;
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    PostgresConnection.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.end()];
                    case 1:
                        _a.sent();
                        this.logger.info('PostgreSQL connection pool closed');
                        return [2 /*return*/];
                }
            });
        });
    };
    return PostgresConnection;
}());
exports.PostgresConnection = PostgresConnection;
// Redis cache implementation
const RedisCache = /** @class */ (function () {
    function RedisCache(config, logger) {
        const _this = this;
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'RedisCache');
        this.client = (0, redis_1.createClient)({
            socket: {
                host: config.host,
                port: config.port,
            },
            password: config.password,
            database: config.database
        });
        this.client.on('error', function (err) {
            _this.logger.error('Redis client error', { error: err.message });
        });
        this.client.on('connect', function () {
            _this.logger.debug('Redis client connected');
        });
    }
    RedisCache.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.connect()];
                    case 1:
                        _a.sent();
                        this.logger.info('Connected to Redis');
                        return [2 /*return*/];
                }
            });
        });
    };
    RedisCache.prototype.get = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            let value, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get(key)];
                    case 1:
                        value = _a.sent();
                        this.logger.debug('Cache get', { key: key, hit: value !== null });
                        return [2 /*return*/, value];
                    case 2:
                        error_3 = _a.sent();
                        this.logger.error('Cache get failed', {
                            key: key,
                            error: error_3 instanceof Error ? error_3.message : 'Unknown error'
                        });
                        throw error_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    RedisCache.prototype.set = function (key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function () {
            let error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        if (!ttlSeconds) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.setEx(key, ttlSeconds, value)];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.client.set(key, value)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        this.logger.debug('Cache set', { key: key, ttl: ttlSeconds });
                        return [3 /*break*/, 6];
                    case 5:
                        error_4 = _a.sent();
                        this.logger.error('Cache set failed', {
                            key: key,
                            ttl: ttlSeconds,
                            error: error_4 instanceof Error ? error_4.message : 'Unknown error'
                        });
                        throw error_4;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    RedisCache.prototype.del = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            let error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.del(key)];
                    case 1:
                        _a.sent();
                        this.logger.debug('Cache delete', { key: key });
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        this.logger.error('Cache delete failed', {
                            key: key,
                            error: error_5 instanceof Error ? error_5.message : 'Unknown error'
                        });
                        throw error_5;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    RedisCache.prototype.exists = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            let exists, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.exists(key)];
                    case 1:
                        exists = _a.sent();
                        return [2 /*return*/, exists === 1];
                    case 2:
                        error_6 = _a.sent();
                        this.logger.error('Cache exists check failed', {
                            key: key,
                            error: error_6 instanceof Error ? error_6.message : 'Unknown error'
                        });
                        throw error_6;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    RedisCache.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.quit()];
                    case 1:
                        _a.sent();
                        this.logger.info('Redis connection closed');
                        return [2 /*return*/];
                }
            });
        });
    };
    return RedisCache;
}());
exports.RedisCache = RedisCache;
// Base repository implementation
const BaseRepository = /** @class */ (function () {
    function BaseRepository(tableName, db, cache, logger) {
        this.tableName = tableName;
        this.db = db;
        this.cache = cache;
        this.logger = logger || (0, observability_1.createLogger)(false, 0, ''.concat(tableName, 'Repository'));
    }
    // Helper methods for common operations
    BaseRepository.prototype.findOne = function (query, params) {
        return __awaiter(this, void 0, void 0, function () {
            let result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query(query, params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows[0]];
                }
            });
        });
    };
    BaseRepository.prototype.findMany = function (query, params) {
        return __awaiter(this, void 0, void 0, function () {
            let result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query(query, params)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rows];
                }
            });
        });
    };
    BaseRepository.prototype.execute = function (query, params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.db.query(query, params)];
            });
        });
    };
    // Cache helper methods
    BaseRepository.prototype.getCacheKey = function (id) {
        return ''.concat(this.tableName, ':').concat(id);
    };
    BaseRepository.prototype.getFromCache = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            let cached, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cache)
                            return [2 /*return*/, undefined];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.cache.get(this.getCacheKey(id))];
                    case 2:
                        cached = _a.sent();
                        if (cached) {
                            this.logger.debug('Cache hit', { table: this.tableName, id: id });
                            return [2 /*return*/, JSON.parse(cached)];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        this.logger.warn('Cache read failed', {
                            table: this.tableName,
                            id: id,
                            error: error_7 instanceof Error ? error_7.message : 'Unknown error'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, undefined];
                }
            });
        });
    };
    BaseRepository.prototype.setInCache = function (id_1, entity_1) {
        return __awaiter(this, arguments, void 0, function (id, entity, ttlSeconds) {
            let error_8;
            if (ttlSeconds === void 0) { ttlSeconds = 3600; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cache)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.cache.set(this.getCacheKey(id), JSON.stringify(entity), ttlSeconds)];
                    case 2:
                        _a.sent();
                        this.logger.debug('Cached entity', { table: this.tableName, id: id, ttl: ttlSeconds });
                        return [3 /*break*/, 4];
                    case 3:
                        error_8 = _a.sent();
                        this.logger.warn('Cache write failed', {
                            table: this.tableName,
                            id: id,
                            error: error_8 instanceof Error ? error_8.message : 'Unknown error'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    BaseRepository.prototype.invalidateCache = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            let error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.cache)
                            return [2 /*return*/];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.cache.del(this.getCacheKey(id))];
                    case 2:
                        _a.sent();
                        this.logger.debug('Cache invalidated', { table: this.tableName, id: id });
                        return [3 /*break*/, 4];
                    case 3:
                        error_9 = _a.sent();
                        this.logger.warn('Cache invalidation failed', {
                            table: this.tableName,
                            id: id,
                            error: error_9 instanceof Error ? error_9.message : 'Unknown error'
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return BaseRepository;
}());
exports.BaseRepository = BaseRepository;
const UserRepository = /** @class */ (function (_super) {
    __extends(UserRepository, _super);
    function UserRepository(db, cache, logger) {
        return _super.call(this, 'users', db, cache, logger) || this;
    }
    UserRepository.prototype.findById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            let cached, user, transformedUser;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getFromCache(id)];
                    case 1:
                        cached = _a.sent();
                        if (cached)
                            return [2 /*return*/, cached];
                        return [4 /*yield*/, this.findOne('SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1', [id])];
                    case 2:
                        user = _a.sent();
                        if (!user) return [3 /*break*/, 4];
                        transformedUser = this.transformFromDb(user);
                        return [4 /*yield*/, this.setInCache(id, transformedUser)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, transformedUser];
                    case 4: return [2 /*return*/, undefined];
                }
            });
        });
    };
    UserRepository.prototype.findByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            let user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.findOne('SELECT id, name, email, created_at, updated_at FROM users WHERE email = $1', [email])];
                    case 1:
                        user = _a.sent();
                        return [2 /*return*/, user ? this.transformFromDb(user) : undefined];
                }
            });
        });
    };
    UserRepository.prototype.save = function (user) {
        return __awaiter(this, void 0, void 0, function () {
            var now, result, updatedUser, result, newUser;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        now = new Date();
                        return [4 /*yield*/, this.findById(user.id)];
                    case 1:
                        if (!_a.sent()) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.execute('UPDATE users \n         SET name = $2, email = $3, updated_at = $4 \n         WHERE id = $1 \n         RETURNING id, name, email, created_at, updated_at', [user.id, user.name, user.email, now])];
                    case 2:
                        result = _a.sent();
                        updatedUser = this.transformFromDb(result.rows[0]);
                        return [4 /*yield*/, this.setInCache(user.id, updatedUser)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, updatedUser];
                    case 4: return [4 /*yield*/, this.execute('INSERT INTO users (id, name, email, created_at, updated_at) \n         VALUES ($1, $2, $3, $4, $5) \n         RETURNING id, name, email, created_at, updated_at', [user.id, user.name, user.email, now, now])];
                    case 5:
                        result = _a.sent();
                        newUser = this.transformFromDb(result.rows[0]);
                        return [4 /*yield*/, this.setInCache(user.id, newUser)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, newUser];
                }
            });
        });
    };
    UserRepository.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.execute('DELETE FROM users WHERE id = $1', [id])];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.invalidateCache(id)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    UserRepository.prototype.findAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            let users;
            const _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.findMany('SELECT id, name, email, created_at, updated_at FROM users ORDER BY created_at DESC')];
                    case 1:
                        users = _a.sent();
                        return [2 /*return*/, users.map(function (user) { return _this.transformFromDb(user); })];
                }
            });
        });
    };
    UserRepository.prototype.transformFromDb = function (dbUser) {
        return {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            createdAt: new Date(dbUser.created_at),
            updatedAt: new Date(dbUser.updated_at)
        };
    };
    return UserRepository;
}(BaseRepository));
exports.UserRepository = UserRepository;
const MigrationRunner = /** @class */ (function () {
    function MigrationRunner(db, logger) {
        this.migrations = new Map();
        this.db = db;
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'MigrationRunner');
    }
    MigrationRunner.prototype.addMigration = function (migration) {
        this.migrations.set(migration.version, migration);
    };
    MigrationRunner.prototype.initializeMigrationTable = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query('\n      CREATE TABLE IF NOT EXISTS schema_migrations (\n        version INTEGER PRIMARY KEY,\n        name VARCHAR(255) NOT NULL,\n        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n      )\n    ')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MigrationRunner.prototype.getCurrentVersion = function () {
        return __awaiter(this, void 0, void 0, function () {
            let result;
            let _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.db.query('SELECT MAX(version) as version FROM schema_migrations')];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.version) || 0];
                }
            });
        });
    };
    MigrationRunner.prototype.migrate = function (targetVersion) {
        return __awaiter(this, void 0, void 0, function () {
            let currentVersion, target, migrationsToRun, _loop_1, this_1, _i, migrationsToRun_1, migration;
            const _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.initializeMigrationTable()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.getCurrentVersion()];
                    case 2:
                        currentVersion = _a.sent();
                        target = targetVersion || Math.max.apply(Math, Array.from(this.migrations.keys()));
                        if (currentVersion >= target) {
                            this.logger.info('Database is already up to date', {
                                currentVersion: currentVersion,
                                targetVersion: target
                            });
                            return [2 /*return*/];
                        }
                        migrationsToRun = Array.from(this.migrations.values())
                            .filter(function (m) { return m.version > currentVersion && m.version <= target; })
                            .sort(function (a, b) { return a.version - b.version; });
                        _loop_1 = function (migration) {
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        this_1.logger.info('Running migration: '.concat(migration.name), {
                                            version: migration.version
                                        });
                                        return [4 /*yield*/, this_1.db.transaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, migration.up(this.db)];
                                                        case 1:
                                                            _a.sent();
                                                            return [4 /*yield*/, client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name])];
                                                        case 2:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); })];
                                    case 1:
                                        _b.sent();
                                        this_1.logger.info('Migration completed: '.concat(migration.name), {
                                            version: migration.version
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, migrationsToRun_1 = migrationsToRun;
                        _a.label = 3;
                    case 3:
                        if (!(_i < migrationsToRun_1.length)) return [3 /*break*/, 6];
                        migration = migrationsToRun_1[_i];
                        return [5 /*yield**/, _loop_1(migration)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MigrationRunner.prototype.rollback = function (targetVersion) {
        return __awaiter(this, void 0, void 0, function () {
            let currentVersion, migrationsToRollback, _loop_2, this_2, _i, migrationsToRollback_1, migration;
            const _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getCurrentVersion()];
                    case 1:
                        currentVersion = _a.sent();
                        if (currentVersion <= targetVersion) {
                            this.logger.info('No rollback needed', {
                                currentVersion: currentVersion,
                                targetVersion: targetVersion
                            });
                            return [2 /*return*/];
                        }
                        migrationsToRollback = Array.from(this.migrations.values())
                            .filter(function (m) { return m.version > targetVersion && m.version <= currentVersion; })
                            .sort(function (a, b) { return b.version - a.version; });
                        _loop_2 = function (migration) {
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        this_2.logger.info('Rolling back migration: '.concat(migration.name), {
                                            version: migration.version
                                        });
                                        return [4 /*yield*/, this_2.db.transaction(function (client) { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, migration.down(this.db)];
                                                        case 1:
                                                            _a.sent();
                                                            return [4 /*yield*/, client.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version])];
                                                        case 2:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); })];
                                    case 1:
                                        _b.sent();
                                        this_2.logger.info('Rollback completed: '.concat(migration.name), {
                                            version: migration.version
                                        });
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, migrationsToRollback_1 = migrationsToRollback;
                        _a.label = 2;
                    case 2:
                        if (!(_i < migrationsToRollback_1.length)) return [3 /*break*/, 5];
                        migration = migrationsToRollback_1[_i];
                        return [5 /*yield**/, _loop_2(migration)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return MigrationRunner;
}());
exports.MigrationRunner = MigrationRunner;
// Health check implementations
const DatabaseHealthCheck = /** @class */ (function () {
    function DatabaseHealthCheck(db) {
        this.db = db;
    }
    DatabaseHealthCheck.prototype.check = function () {
        return __awaiter(this, void 0, void 0, function () {
            let start, latency, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        start = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.db.query('SELECT 1')];
                    case 2:
                        _a.sent();
                        latency = Date.now() - start;
                        return [2 /*return*/, { healthy: true, latency: latency }];
                    case 3:
                        error_10 = _a.sent();
                        return [2 /*return*/, {
                                healthy: false,
                                error: error_10 instanceof Error ? error_10.message : 'Unknown error'
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return DatabaseHealthCheck;
}());
exports.DatabaseHealthCheck = DatabaseHealthCheck;
const CacheHealthCheck = /** @class */ (function () {
    function CacheHealthCheck(cache) {
        this.cache = cache;
    }
    CacheHealthCheck.prototype.check = function () {
        return __awaiter(this, void 0, void 0, function () {
            let start, testKey, latency, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        start = Date.now();
                        testKey = '__health_check__';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.cache.set(testKey, 'test', 10)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.cache.get(testKey)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, this.cache.del(testKey)];
                    case 4:
                        _a.sent();
                        latency = Date.now() - start;
                        return [2 /*return*/, { healthy: true, latency: latency }];
                    case 5:
                        error_11 = _a.sent();
                        return [2 /*return*/, {
                                healthy: false,
                                error: error_11 instanceof Error ? error_11.message : 'Unknown error'
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return CacheHealthCheck;
}());
exports.CacheHealthCheck = CacheHealthCheck;
