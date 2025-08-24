"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainEventFactory = exports.EventBus = exports.AggregateRoot = exports.InMemoryEventStore = void 0;
var observability_1 = require("@foundation/observability");
var node_crypto_1 = require("node:crypto");
// In-memory event store implementation
var InMemoryEventStore = /** @class */ (function () {
    function InMemoryEventStore(logger) {
        this.events = new Map();
        this.snapshots = new Map();
        this.eventHandlers = new Map();
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'EventStore');
    }
    InMemoryEventStore.prototype.saveEvents = function (aggregateId, aggregateType, events, expectedVersion) {
        return __awaiter(this, void 0, void 0, function () {
            var streamKey, existingEvents, storedEvents, _i, events_1, event_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        streamKey = "".concat(aggregateType, ":").concat(aggregateId);
                        existingEvents = this.events.get(streamKey) || [];
                        if (expectedVersion !== undefined && existingEvents.length !== expectedVersion) {
                            throw new Error("Concurrency conflict. Expected version ".concat(expectedVersion, ", but stream has ").concat(existingEvents.length, " events"));
                        }
                        storedEvents = events.map(function (event, index) { return ({
                            id: (0, node_crypto_1.randomUUID)(),
                            aggregateId: aggregateId,
                            aggregateType: aggregateType,
                            eventType: event.eventType,
                            eventData: event.eventData,
                            eventVersion: existingEvents.length + index + 1,
                            timestamp: event.timestamp,
                            metadata: event.metadata
                        }); });
                        this.events.set(streamKey, __spreadArray(__spreadArray([], existingEvents, true), storedEvents, true));
                        this.logger.info("Saved ".concat(events.length, " events for ").concat(aggregateType, ":").concat(aggregateId), {
                            aggregateId: aggregateId,
                            aggregateType: aggregateType,
                            eventCount: events.length,
                            newVersion: existingEvents.length + events.length
                        });
                        _i = 0, events_1 = events;
                        _a.label = 1;
                    case 1:
                        if (!(_i < events_1.length)) return [3 /*break*/, 4];
                        event_1 = events_1[_i];
                        return [4 /*yield*/, this.publishEvent(event_1)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    InMemoryEventStore.prototype.loadEvents = function (aggregateId, aggregateType, fromVersion) {
        return __awaiter(this, void 0, void 0, function () {
            var streamKey, events;
            return __generator(this, function (_a) {
                streamKey = "".concat(aggregateType, ":").concat(aggregateId);
                events = this.events.get(streamKey) || [];
                if (fromVersion !== undefined) {
                    return [2 /*return*/, events.filter(function (event) { return event.eventVersion > fromVersion; })];
                }
                return [2 /*return*/, events];
            });
        });
    };
    InMemoryEventStore.prototype.loadEventStream = function (aggregateId, aggregateType) {
        return __awaiter(this, void 0, void 0, function () {
            var events;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.loadEvents(aggregateId, aggregateType)];
                    case 1:
                        events = _a.sent();
                        if (events.length === 0) {
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/, {
                                aggregateId: aggregateId,
                                aggregateType: aggregateType,
                                events: events,
                                version: events.length
                            }];
                }
            });
        });
    };
    InMemoryEventStore.prototype.saveSnapshot = function (snapshot) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshotKey;
            return __generator(this, function (_a) {
                snapshotKey = "".concat(snapshot.aggregateType, ":").concat(snapshot.aggregateId);
                this.snapshots.set(snapshotKey, snapshot);
                this.logger.info("Saved snapshot for ".concat(snapshot.aggregateType, ":").concat(snapshot.aggregateId), {
                    aggregateId: snapshot.aggregateId,
                    aggregateType: snapshot.aggregateType,
                    version: snapshot.version
                });
                return [2 /*return*/];
            });
        });
    };
    InMemoryEventStore.prototype.loadSnapshot = function (aggregateId, aggregateType) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshotKey;
            return __generator(this, function (_a) {
                snapshotKey = "".concat(aggregateType, ":").concat(aggregateId);
                return [2 /*return*/, this.snapshots.get(snapshotKey)];
            });
        });
    };
    // Event subscription and publishing
    InMemoryEventStore.prototype.subscribe = function (eventType, handler) {
        var handlers = this.eventHandlers.get(eventType) || [];
        handlers.push(handler);
        this.eventHandlers.set(eventType, handlers);
        this.logger.info("Subscribed handler for event type: ".concat(eventType));
    };
    InMemoryEventStore.prototype.publishEvent = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var handlers, _i, handlers_1, handler, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        handlers = this.eventHandlers.get(event.eventType) || [];
                        _i = 0, handlers_1 = handlers;
                        _a.label = 1;
                    case 1:
                        if (!(_i < handlers_1.length)) return [3 /*break*/, 6];
                        handler = handlers_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, handler(event)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        this.logger.error("Error in event handler for ".concat(event.eventType), {
                            eventType: event.eventType,
                            aggregateId: event.aggregateId,
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        });
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // Query methods
    InMemoryEventStore.prototype.getAllEvents = function (aggregateType) {
        return __awaiter(this, void 0, void 0, function () {
            var allEvents;
            return __generator(this, function (_a) {
                allEvents = [];
                Array.from(this.events.entries()).forEach(function (_a) {
                    var streamKey = _a[0], events = _a[1];
                    if (!aggregateType || streamKey.startsWith("".concat(aggregateType, ":"))) {
                        allEvents.push.apply(allEvents, events);
                    }
                });
                return [2 /*return*/, allEvents.sort(function (a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); })];
            });
        });
    };
    InMemoryEventStore.prototype.getEventsByType = function (eventType) {
        return __awaiter(this, void 0, void 0, function () {
            var allEvents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllEvents()];
                    case 1:
                        allEvents = _a.sent();
                        return [2 /*return*/, allEvents.filter(function (event) { return event.eventType === eventType; })];
                }
            });
        });
    };
    InMemoryEventStore.prototype.getEventsAfter = function (timestamp, aggregateType) {
        return __awaiter(this, void 0, void 0, function () {
            var allEvents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAllEvents(aggregateType)];
                    case 1:
                        allEvents = _a.sent();
                        return [2 /*return*/, allEvents.filter(function (event) { return event.timestamp > timestamp; })];
                }
            });
        });
    };
    return InMemoryEventStore;
}());
exports.InMemoryEventStore = InMemoryEventStore;
// Base aggregate root class
var AggregateRoot = /** @class */ (function () {
    function AggregateRoot(id) {
        this.version = 0;
        this.uncommittedEvents = [];
        this.id = id;
    }
    AggregateRoot.prototype.getId = function () {
        return this.id;
    };
    AggregateRoot.prototype.getVersion = function () {
        return this.version;
    };
    AggregateRoot.prototype.getUncommittedEvents = function () {
        return __spreadArray([], this.uncommittedEvents, true);
    };
    AggregateRoot.prototype.markEventsAsCommitted = function () {
        this.uncommittedEvents = [];
    };
    AggregateRoot.prototype.applyEvent = function (event) {
        this.uncommittedEvents.push(event);
        this.version++;
        this.handle(event);
    };
    AggregateRoot.fromHistory = function (constructor, events) {
        if (events.length === 0) {
            throw new Error('Cannot create aggregate from empty event history');
        }
        var aggregate = new constructor(events[0].aggregateId);
        for (var _i = 0, events_2 = events; _i < events_2.length; _i++) {
            var storedEvent = events_2[_i];
            var domainEvent = {
                aggregateId: storedEvent.aggregateId,
                eventType: storedEvent.eventType,
                eventData: storedEvent.eventData,
                timestamp: storedEvent.timestamp,
                metadata: storedEvent.metadata
            };
            aggregate.handle(domainEvent);
            aggregate.version = storedEvent.eventVersion;
        }
        return aggregate;
    };
    return AggregateRoot;
}());
exports.AggregateRoot = AggregateRoot;
// Event bus for cross-aggregate communication
var EventBus = /** @class */ (function () {
    function EventBus(logger) {
        this.subscribers = new Map();
        this.logger = logger || (0, observability_1.createLogger)(false, 0, 'EventBus');
    }
    EventBus.prototype.subscribe = function (eventType, handler) {
        var handlers = this.subscribers.get(eventType) || [];
        handlers.push(handler);
        this.subscribers.set(eventType, handlers);
        this.logger.info("Subscribed to event type: ".concat(eventType));
    };
    EventBus.prototype.publish = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var handlers, promises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        handlers = this.subscribers.get(event.eventType) || [];
                        this.logger.info("Publishing event: ".concat(event.eventType), {
                            eventType: event.eventType,
                            aggregateId: event.aggregateId,
                            handlerCount: handlers.length
                        });
                        promises = handlers.map(function (handler) { return __awaiter(_this, void 0, void 0, function () {
                            var error_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, handler(event)];
                                    case 1:
                                        _a.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        error_2 = _a.sent();
                                        this.logger.error("Error in event handler for ".concat(event.eventType), {
                                            eventType: event.eventType,
                                            aggregateId: event.aggregateId,
                                            error: error_2 instanceof Error ? error_2.message : 'Unknown error'
                                        });
                                        throw error_2;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return EventBus;
}());
exports.EventBus = EventBus;
// Domain event factory
var DomainEventFactory = /** @class */ (function () {
    function DomainEventFactory() {
    }
    DomainEventFactory.create = function (aggregateId, eventType, eventData, metadata) {
        return {
            aggregateId: aggregateId,
            eventType: eventType,
            eventData: eventData,
            timestamp: new Date(),
            metadata: metadata
        };
    };
    return DomainEventFactory;
}());
exports.DomainEventFactory = DomainEventFactory;
// Export all types and implementations
__exportStar(require("@foundation/contracts"), exports);
