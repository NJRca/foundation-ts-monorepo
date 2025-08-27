import { NextFunction, Request, Response } from 'express';

import { Logger } from '@foundation/contracts';

export type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export function createRequestContextMiddleware(opts: {
  generateRequestId: () => string;
  logger: Logger;
}) {
  const { generateRequestId, logger } = opts;

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
    const context = {
      requestId,
      userId: (req.headers['x-user-id'] as string) || undefined,
      userAgent: (req.headers['user-agent'] as string) || undefined,
      ip:
        (typeof req.ip === 'string' && req.ip) ||
        (req.socket as unknown as { remoteAddress?: string })?.remoteAddress ||
        'unknown',
      startTime: new Date(),
      path: req.path,
      method: req.method,
    };

    // Attach to request with a typed property (kept as index property)
    (req as unknown as Record<string, unknown>).context = context;
    res.setHeader('X-Request-ID', requestId);

    logger.info(`${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      userAgent: context.userAgent,
      ip: context.ip,
    });

    next();
  };
}

export function createCompressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send.bind(res);

    // Override send with a typed signature
    type SendFn = (this: Response, body?: unknown) => Response;
    const typedOriginalSend = originalSend as SendFn;

    (res as unknown as Record<string, unknown>).send = function (
      this: Response,
      data?: unknown
    ): Response {
      if (typeof data === 'string' && data.length > 1024) {
        this.setHeader('Content-Encoding', 'gzip');
      }
      return typedOriginalSend.call(this, data);
    } as unknown as typeof res.send;

    next();
  };
}
