import { InMemoryTracer, Span, Tracer } from './index';

import { Logger } from '@foundation/contracts';

/** Lightweight TracingService to encapsulate tracer creation and span lifecycle */
export class TracingService {
  private readonly tracer: Tracer;

  constructor(tracer: Tracer) {
    this.tracer = tracer;
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  startSpan(operationName: string): Span {
    return this.tracer.startSpan(operationName);
  }

  finishSpan(span: Span): void {
    this.tracer.finishSpan(span);
  }
}

export function createTracingService(enableTracing: boolean, logger: Logger): TracingService {
  if (enableTracing) {
    return new TracingService(new InMemoryTracer(logger));
  }

  const noopTracer: Tracer = {
    startSpan: (operationName: string) => ({
      traceId: 'none',
      spanId: 'none',
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'success',
      baggage: {},
    }),
    finishSpan: (_span: Span) => {
      /* no-op */
    },
    extractSpan: () => undefined,
    injectSpan: () => undefined,
  };

  return new TracingService(noopTracer);
}
