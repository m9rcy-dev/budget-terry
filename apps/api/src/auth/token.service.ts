import { createHash, randomBytes, randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface GeneratedRefreshToken {
  /** Returned to the client — never stored. */
  token: string;
  /** Stored server-side; the raw token can't be recovered from this. */
  tokenHash: string;
  expiresAt: Date;
}

export interface GeneratedLoginCode {
  /** The 6-digit string emailed to the user — never stored. */
  code: string;
  /** Stored server-side; the raw code can't be recovered from this. */
  codeHash: string;
  expiresAt: Date;
}

export interface GeneratedDeviceTrustToken {
  /** Returned to the client — never stored. */
  token: string;
  /** Stored server-side; the raw token can't be recovered from this. */
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Access tokens are short-lived signed JWTs. Refresh tokens are opaque
 * random values — only their SHA-256 hash is stored, so a database leak
 * doesn't hand out usable tokens. A fast hash is appropriate here (unlike
 * passwords) because the token's entropy, not hash cost, is what makes it
 * unguessable. See ADR-011.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get("AUTH_SECRET", { infer: true }),
      expiresIn: this.accessTokenTtlSeconds,
    });
  }

  get accessTokenTtlSeconds(): number {
    return this.configService.get("ACCESS_TOKEN_TTL_SECONDS", { infer: true });
  }

  generateRefreshToken(): GeneratedRefreshToken {
    const token = randomBytes(48).toString("base64url");
    const refreshTokenTtlDays = this.configService.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });
    const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    return { token, tokenHash: this.hashRefreshToken(token), expiresAt };
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Passwordless email login. Same "only the hash is stored" principle as
   * the refresh token above, using crypto.randomInt (not Math.random) so
   * the code is unguessable from anything but brute force — which is why
   * AuthService also enforces a short expiry and a per-code attempt
   * lockout on top of this. See LoginCode in schema.prisma.
   */
  generateLoginCode(): GeneratedLoginCode {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const ttlMinutes = this.configService.get("LOGIN_CODE_TTL_MINUTES", { infer: true });
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    return { code, codeHash: this.hashLoginCode(code), expiresAt };
  }

  hashLoginCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /**
   * "Remember this device" — opaque, long-lived, same only-the-hash-is-
   * stored/rotate-on-use shape as the refresh token, but a separate token
   * entirely (DeviceTrust, not RefreshToken): it must survive logout. See
   * docs/trusted-device-plan.md.
   */
  generateDeviceTrustToken(): GeneratedDeviceTrustToken {
    const token = randomBytes(48).toString("base64url");
    const ttlDays = this.configService.get("DEVICE_TRUST_TTL_DAYS", { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    return { token, tokenHash: this.hashDeviceTrustToken(token), expiresAt };
  }

  hashDeviceTrustToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
