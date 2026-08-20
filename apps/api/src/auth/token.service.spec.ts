import { JwtService } from "@nestjs/jwt";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { TokenService } from "./token.service";

function fakeConfigService(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values: Env = {
    DATABASE_URL: "postgresql://test",
    AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
    API_PORT: 3001,
    WEB_ORIGIN: "http://localhost:3000",
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 30,
    LOG_LEVEL: "info",
    ...overrides,
  };

  return { get: (key: keyof Env) => values[key] } as ConfigService<Env, true>;
}

describe("TokenService", () => {
  it("signs an access token containing the user id and email", () => {
    const jwtService = new JwtService({});
    const tokenService = new TokenService(jwtService, fakeConfigService());

    const token = tokenService.signAccessToken({ sub: "user-1", email: "test@example.com" });
    const decoded = jwtService.decode(token) as { sub: string; email: string };

    expect(decoded.sub).toBe("user-1");
    expect(decoded.email).toBe("test@example.com");
  });

  it("generates a refresh token whose hash matches hashRefreshToken for the same value", () => {
    const tokenService = new TokenService(new JwtService({}), fakeConfigService());

    const generated = tokenService.generateRefreshToken();

    expect(tokenService.hashRefreshToken(generated.token)).toBe(generated.tokenHash);
  });

  it("sets the refresh token expiry according to REFRESH_TOKEN_TTL_DAYS", () => {
    const tokenService = new TokenService(
      new JwtService({}),
      fakeConfigService({ REFRESH_TOKEN_TTL_DAYS: 1 }),
    );
    const expected = Date.now() + 24 * 60 * 60 * 1000;

    const generated = tokenService.generateRefreshToken();

    expect(generated.expiresAt.getTime()).toBeGreaterThanOrEqual(expected - 5000);
    expect(generated.expiresAt.getTime()).toBeLessThanOrEqual(expected + 5000);
  });
});
