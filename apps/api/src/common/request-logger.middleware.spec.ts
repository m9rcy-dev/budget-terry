import type { Request, Response } from "express";
import { createRequestLoggerMiddleware } from "./request-logger.middleware";

function fakeReqRes(overrides: { headers?: Record<string, string>; user?: { sub?: string } }): {
  req: Request;
  res: Response;
  triggerFinish: () => void;
} {
  const finishHandlers: Array<() => void> = [];
  const headers: Record<string, string> = {};

  const req = {
    headers: overrides.headers ?? {},
    method: "GET",
    originalUrl: "/accounts",
    user: overrides.user,
  } as unknown as Request;

  const res = {
    statusCode: 200,
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    getHeader: (key: string) => headers[key],
    on: (event: string, handler: () => void) => {
      if (event === "finish") finishHandlers.push(handler);
    },
  } as unknown as Response;

  return { req, res, triggerFinish: () => finishHandlers.forEach((handler) => handler()) };
}

describe("createRequestLoggerMiddleware", () => {
  let writeSpy: jest.SpyInstance;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("sets a generated correlation id header and logs it on finish", () => {
    const middleware = createRequestLoggerMiddleware("info");
    const { req, res, triggerFinish } = fakeReqRes({});
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.getHeader("X-Correlation-Id")).toEqual(expect.any(String));

    triggerFinish();

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(logged.correlationId).toBe(res.getHeader("X-Correlation-Id"));
    expect(logged.method).toBe("GET");
    expect(logged.path).toBe("/accounts");
    expect(logged.statusCode).toBe(200);
    expect(typeof logged.durationMs).toBe("number");
    expect(logged.userId).toBeUndefined();
  });

  it("reuses an incoming X-Correlation-Id header instead of generating a new one", () => {
    const middleware = createRequestLoggerMiddleware("info");
    const { req, res, triggerFinish } = fakeReqRes({
      headers: { "x-correlation-id": "client-supplied-id" },
    });

    middleware(req, res, jest.fn());
    expect(res.getHeader("X-Correlation-Id")).toBe("client-supplied-id");

    triggerFinish();
    const logged = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(logged.correlationId).toBe("client-supplied-id");
  });

  it("includes userId when the request is authenticated", () => {
    const middleware = createRequestLoggerMiddleware("info");
    const { req, res, triggerFinish } = fakeReqRes({ user: { sub: "user-123" } });

    middleware(req, res, jest.fn());
    triggerFinish();

    const logged = JSON.parse((writeSpy.mock.calls[0]![0] as string).trim());
    expect(logged.userId).toBe("user-123");
  });

  it("never logs at a quieter level than configured (warn suppresses info-level request logs)", () => {
    const middleware = createRequestLoggerMiddleware("warn");
    const { req, res, triggerFinish } = fakeReqRes({});

    middleware(req, res, jest.fn());
    triggerFinish();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("still sets the correlation header even when logging is suppressed", () => {
    const middleware = createRequestLoggerMiddleware("error");
    const { req, res } = fakeReqRes({});
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.getHeader("X-Correlation-Id")).toEqual(expect.any(String));
    expect(next).toHaveBeenCalled();
  });
});
