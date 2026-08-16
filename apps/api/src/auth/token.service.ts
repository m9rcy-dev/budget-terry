import { createHash, randomBytes } from "node:crypto";
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
}
