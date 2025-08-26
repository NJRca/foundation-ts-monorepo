// ALLOW_COMPLEXITY_DELTA: Event wiring contains multiple handlers and adapters
// which increase file length; mark as allowed for policy.
import { DomainEvent, EventStore, Logger } from '@foundation/contracts';

import { createLogger } from '@foundation/observability';
import { randomUUID } from 'node:crypto';

// Event store interfaces
export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: Record<string, unknown>;
  eventVersion: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: StoredEvent[];
  version: number;
}

export interface EventStoreSnapshot {
  aggregateId: string;
  aggregateType: string;
  data: Record<string, unknown>;
  version: number;
  timestamp: Date;
}

// In-memory event store implementation
// @intent: InMemoryEventStore
// Purpose: in-memory event persistence for local development and tests.
// Constraints: not durable across process restarts; synchronous-ish API using in-process maps.
export class InMemoryEventStore implements EventStore {
  private readonly events: Map<string, StoredEvent[]> = new Map();
  private readonly snapshots: Map<string, EventStoreSnapshot> = new Map();
  private readonly logger: Logger;
  private readonly eventHandlers: Map<string, ((event: DomainEvent) => void | Promise<void>)[]> =
    new Map();

  constructor(logger?: Logger) {
    this.logger = logger || createLogger(false, 0, 'EventStore');
  }

  async saveEvents(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    const streamKey = `${aggregateType}:${aggregateId}`;
    const existingEvents = this.events.get(streamKey) || [];

    if (expectedVersion !== undefined && existingEvents.length !== expectedVersion) {
      throw new Error(
        `Concurrency conflict. Expected version ${expectedVersion}, but stream has ${existingEvents.length} events`
      );
    }

    const storedEvents: StoredEvent[] = events.map((event, index) => ({
      id: randomUUID(),
      aggregateId,
      aggregateType,
      eventType: event.eventType,
      eventData: event.eventData,
      eventVersion: existingEvents.length + index + 1,
      timestamp: event.timestamp,
      metadata: event.metadata,
    }));

    this.events.set(streamKey, [...existingEvents, ...storedEvents]);

    this.logger.info(`Saved ${events.length} events for ${aggregateType}:${aggregateId}`, {
      aggregateId,
      aggregateType,
      eventCount: events.length,
      newVersion: existingEvents.length + events.length,
    });

    // Publish events to handlers
    for (const event of events) {
      await this.publishEvent(event);
    }
  }

  async loadEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion?: number
  ): Promise<StoredEvent[]> {
    const streamKey = `${aggregateType}:${aggregateId}`;
    const events = this.events.get(streamKey) || [];

    if (fromVersion !== undefined) {
      return events.filter(event => event.eventVersion > fromVersion);
    }

    return events;
  }

  async loadEventStream(
    aggregateId: string,
    aggregateType: string
  ): Promise<EventStream | undefined> {
    const events = await this.loadEvents(aggregateId, aggregateType);

    if (events.length === 0) {
      return undefined;
    }

    return {
      aggregateId,
      aggregateType,
      events,
      version: events.length,
    };
  }

  async saveSnapshot(snapshot: EventStoreSnapshot): Promise<void> {
    const snapshotKey = `${snapshot.aggregateType}:${snapshot.aggregateId}`;
    this.snapshots.set(snapshotKey, snapshot);

    this.logger.info(`Saved snapshot for ${snapshot.aggregateType}:${snapshot.aggregateId}`, {
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      version: snapshot.version,
    });
  }

  async loadSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<EventStoreSnapshot | undefined> {
    const snapshotKey = `${aggregateType}:${aggregateId}`;
    return this.snapshots.get(snapshotKey);
  }

  // Event subscription and publishing
  subscribe(eventType: string, handler: (event: DomainEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);

    this.logger.info(`Subscribed handler for event type: ${eventType}`);
  }

  private async publishEvent(event: DomainEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.eventType) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event.eventType}`, {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // Query methods
  async getAllEvents(aggregateType?: string): Promise<StoredEvent[]> {
    const allEvents: StoredEvent[] = [];

    Array.from(this.events.entries()).forEach(([streamKey, events]) => {
      if (!aggregateType || streamKey.startsWith(`${aggregateType}:`)) {
        allEvents.push(...events);
      }
    });

    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getEventsByType(eventType: string): Promise<StoredEvent[]> {
    const allEvents = await this.getAllEvents();
    return allEvents.filter(event => event.eventType === eventType);
  }

  async getEventsAfter(timestamp: Date, aggregateType?: string): Promise<StoredEvent[]> {
    const allEvents = await this.getAllEvents(aggregateType);
    return allEvents.filter(event => event.timestamp > timestamp);
  }
}

// Base aggregate root class
// @intent: AggregateRoot
// Purpose: base class for domain aggregates to manage event application and versioning.
// Constraints: subclasses must implement `handle` to apply domain events.
export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  getVersion(): number {
    return this.version;
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  protected applyEvent(event: DomainEvent): void {
    this.uncommittedEvents.push(event);
    this.version++;
    this.handle(event);
  }

  protected abstract handle(event: DomainEvent): void;

  static fromHistory<T extends AggregateRoot>(
    constructor: new (id: string) => T,
    events: StoredEvent[]
  ): T {
    if (events.length === 0) {
      throw new Error('Cannot create aggregate from empty event history');
    }

    const aggregate = new constructor(events[0].aggregateId);

    for (const storedEvent of events) {
      const domainEvent: DomainEvent = {
        aggregateId: storedEvent.aggregateId,
        eventType: storedEvent.eventType,
        eventData: storedEvent.eventData,
        timestamp: storedEvent.timestamp,
        metadata: storedEvent.metadata,
      };

      aggregate.handle(domainEvent);
      aggregate.version = storedEvent.eventVersion;
    }

    return aggregate;
  }
}

// Event bus for cross-aggregate communication
// @intent: EventBus
// Purpose: simple in-process event bus for cross-component communication.
// Constraints: handlers run in-process; failures bubble by design unless caught by handlers.
export class EventBus {
  private readonly logger: Logger;
  private readonly subscribers: Map<string, ((event: DomainEvent) => Promise<void>)[]> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || createLogger(false, 0, 'EventBus');
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const handlers = this.subscribers.get(eventType) || [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);

    this.logger.info(`Subscribed to event type: ${eventType}`);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.subscribers.get(event.eventType) || [];

    this.logger.info(`Publishing event: ${event.eventType}`, {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      handlerCount: handlers.length,
    });

    const promises = handlers.map(async handler => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in event handler for ${event.eventType}`, {
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    await Promise.all(promises);
  }
}

// Domain event factory
// @intent: DomainEventFactory
// Purpose: deterministic factory for DomainEvent objects with timestamp.
export class DomainEventFactory {
  static create(
    aggregateId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): DomainEvent {
    return {
      aggregateId,
      eventType,
      eventData,
      timestamp: new Date(),
      metadata,
    };
  }
}

// Export all types and implementations
export * from '@foundation/contracts';
