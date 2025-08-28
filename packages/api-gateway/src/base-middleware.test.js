// Require compiled output so Jest doesn't need to parse TypeScript
const { createRequestContextMiddleware } = require('../dist/base-middleware');

const { describe, test, expect } = require('@jest/globals');

describe('ApiGateway base middleware (compiled)', () => {
  test('createRequestContextMiddleware attaches context and sets X-Request-ID', () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    const middleware = createRequestContextMiddleware({
      generateRequestId: () => 'req_123',
      logger: mockLogger,
    });

    const req = { headers: {}, path: '/test', method: 'GET', ip: '1.2.3.4' };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.context).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    expect(next).toHaveBeenCalled();
  });
});
