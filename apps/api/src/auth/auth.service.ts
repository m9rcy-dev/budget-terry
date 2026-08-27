import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { AuthResponse, AuthTokens, AuthenticatedUser } from "@budget-terry/types";
import type { LoginInput, RegisterInput } from "@budget-terry/validation";
import { seedDefaultCategories } from "../categories/default-categories";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  onboardingCompletedAt: Date | null;
}

/** Wrong email, wrong/expired code, and too-many-attempts all throw this
 * exact exception — never reveal which one it was, same principle as
 * login's generic "Invalid email or password." (see AuthService.login). */
function invalidLoginCode(): UnauthorizedException {
  return new UnauthorizedException("Invalid or expired code.");
}

/** Unknown/expired/revoked device trust tokens all throw this exact
 * exception — same "never reveal which part failed" principle as above. */
function invalidDeviceTrust(): UnauthorizedException {
  return new UnauthorizedException("Invalid or expired device trust.");
}

/** Per-code lockout — independent of the request-level rate limiting on
 * the controller. A code becomes unusable after this many wrong guesses,
 * not just after enough HTTP requests to trip the throttle. */
const MAX_LOGIN_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = await this.prisma.user.create({
      data: { email: input.email, displayName: input.displayName, passwordHash },
    });

    await seedDefaultCategories(this.prisma, user.id);

    // Best-effort — a failed welcome email must never fail registration
    // itself, so this is caught and logged, not awaited into the response.
    this.mailService.sendWelcomeEmail(user.email, user.displayName).catch((error: unknown) => {
      this.logger.warn(`Failed to send welcome email to ${user.email}: ${String(error)}`);
    });

    return this.issueTokens(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Deliberately the same generic message whether the email is unknown
    // or the password is wrong — never reveal which one it was.
    if (!user || !(await this.passwordService.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });

    // Rotate rather than reuse: revoke the presented token and issue a new
    // one, so a leaked-but-unused token has a one-time window, not a
    // 30-day one. See ADR-011.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(user);
    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Always resolves the same way regardless of whether the email has an
   * account — same "never reveal which part failed" principle as login.
   * Only actually generates/sends a code when a matching user exists.
   */
  async requestLoginCode(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const { code, codeHash, expiresAt } = this.tokenService.generateLoginCode();

    // Only the most recently requested code is usable — otherwise an
    // earlier, still-unexpired code silently keeps working after the user
    // asked for a new one.
    await this.prisma.loginCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.loginCode.create({ data: { userId: user.id, codeHash, expiresAt } });

    await this.mailService.sendLoginCode(user.email, code);
  }

  async verifyLoginCode(
    email: string,
    submittedCode: string,
    rememberDevice?: boolean,
  ): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw invalidLoginCode();
    }

    const latestCode = await this.prisma.loginCode.findFirst({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!latestCode || latestCode.attempts >= MAX_LOGIN_CODE_ATTEMPTS) {
      throw invalidLoginCode();
    }

    const submittedHash = this.tokenService.hashLoginCode(submittedCode);
    if (submittedHash !== latestCode.codeHash) {
      await this.prisma.loginCode.update({
        where: { id: latestCode.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalidLoginCode();
    }

    await this.prisma.loginCode.update({
      where: { id: latestCode.id },
      data: { consumedAt: new Date() },
    });

    const response = await this.issueTokens(user);
    if (!rememberDevice) {
      return response;
    }

    const deviceTrustToken = await this.createDeviceTrust(user.id);
    return { ...response, deviceTrustToken };
  }

  /**
   * The trusted-device equivalent of `refresh` — presents an opaque token
   * instead of an email+code, skipping the login-code round trip entirely.
   * Rotates the token on every use (same reasoning as refresh-token
   * rotation, ADR-011) and, unlike refresh, this token is never revoked by
   * `logout` — that's the point of "remember this device".
   */
  async deviceLogin(deviceTrustToken: string): Promise<AuthResponse> {
    const tokenHash = this.tokenService.hashDeviceTrustToken(deviceTrustToken);
    const stored = await this.prisma.deviceTrust.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw invalidDeviceTrust();
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });

    await this.prisma.deviceTrust.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const response = await this.issueTokens(user);
    const newDeviceTrustToken = await this.createDeviceTrust(user.id);
    return { ...response, deviceTrustToken: newDeviceTrustToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toAuthenticatedUser(user);
  }

  async completeOnboarding(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
    return toAuthenticatedUser(user);
  }

  private async createDeviceTrust(userId: string): Promise<string> {
    const { token, tokenHash, expiresAt } = this.tokenService.generateDeviceTrustToken();
    await this.prisma.deviceTrust.create({ data: { userId, tokenHash, expiresAt } });
    return token;
  }

  private async issueTokens(user: UserRecord): Promise<AuthResponse> {
    const accessToken = this.tokenService.signAccessToken({ sub: user.id, email: user.email });
    const { token: refreshToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return { user: toAuthenticatedUser(user), accessToken, refreshToken };
  }
}

function toAuthenticatedUser(user: UserRecord): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}
