import { NextFunction, Request, Response } from 'express';

import { Logger } from '@foundation/contracts';
import { createRequestContextMiddleware } from './base-middleware';

describe('ApiGateway base middleware', () => {
  test('createRequestContextMiddleware attaches context and sets X-Request-ID', () => {
    const mockLogger: Logger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as Logger;

    const middleware = createRequestContextMiddleware({
      generateRequestId: () => 'req_123',
      logger: mockLogger,
    });

    const req = { headers: {}, path: '/test', method: 'GET', ip: '1.2.3.4' } as unknown as Request &
      Record<string, unknown>;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect((req as Record<string, unknown>).context).toBeDefined();
    expect((res as unknown as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.any(String)
    );
    expect(next as jest.Mock).toHaveBeenCalled();
  });
});
