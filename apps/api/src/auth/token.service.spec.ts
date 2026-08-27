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
    MAIL_PROVIDER: "smtp",
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    RESEND_API_KEY: "",
    MAIL_FROM: "Budget Terry <no-reply@budgetterry.local>",
    LOGIN_CODE_TTL_MINUTES: 10,
    DEVICE_TRUST_TTL_DAYS: 90,
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

  it("generates a device trust token whose hash matches hashDeviceTrustToken for the same value", () => {
    const tokenService = new TokenService(new JwtService({}), fakeConfigService());

    const generated = tokenService.generateDeviceTrustToken();

    expect(tokenService.hashDeviceTrustToken(generated.token)).toBe(generated.tokenHash);
  });

  it("sets the device trust token expiry according to DEVICE_TRUST_TTL_DAYS", () => {
    const tokenService = new TokenService(
      new JwtService({}),
      fakeConfigService({ DEVICE_TRUST_TTL_DAYS: 1 }),
    );
    const expected = Date.now() + 24 * 60 * 60 * 1000;

    const generated = tokenService.generateDeviceTrustToken();

    expect(generated.expiresAt.getTime()).toBeGreaterThanOrEqual(expected - 5000);
    expect(generated.expiresAt.getTime()).toBeLessThanOrEqual(expected + 5000);
  });
});
