const { createLogger, LogLevel } = require('../dist/index.js');
const { createTracingService } = require('../dist/tracing.js');

describe('TracingService', () => {
  test('startSpan and finishSpan lifecycle', () => {
    const logger = createLogger(false, LogLevel.DEBUG, 'test');
    const svc = createTracingService(true, logger);

    const span = svc.startSpan('op');
    expect(span).toBeDefined();
    expect(span.operationName).toBe('op');

    svc.finishSpan(span);
    expect(span.endTime).toBeDefined();
    expect(span.duration).toBeGreaterThanOrEqual(0);
  });
});
