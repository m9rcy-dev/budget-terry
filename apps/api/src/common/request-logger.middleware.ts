import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env";

const LEVEL_PRIORITY: Record<Env["LOG_LEVEL"], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Structured (one JSON object per line) request logging per plan Section
 * 40 — correlationId, userId where safe, requestPath, statusCode, duration.
 * Deliberately never touches req.body/res.body, so it can't ever log a
 * password, token, or financial payload by construction, not by
 * remembering to filter one out.
 *
 * `req.user` is read inside the `res.on("finish", ...)` callback, not at
 * the top of the middleware — Express middleware runs before Nest's
 * guards, but `finish` fires after the whole request lifecycle completes
 * (including JwtAuthGuard attaching `req.user`), since both share the same
 * mutable `req` object reference.
 */
export function createRequestLoggerMiddleware(
  logLevel: Env["LOG_LEVEL"],
): (req: Request, res: Response, next: NextFunction) => void {
  const requestLevelEnabled = LEVEL_PRIORITY[logLevel] <= LEVEL_PRIORITY.info;

  return function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
    res.setHeader("X-Correlation-Id", correlationId);

    if (!requestLevelEnabled) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const userId = (req as { user?: { sub?: string } }).user?.sub;

      process.stdout.write(
        `${JSON.stringify({
          correlationId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          ...(userId ? { userId } : {}),
        })}\n`,
      );
    });

    next();
  };
}
