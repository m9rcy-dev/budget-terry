import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthResponse, AuthTokens, AuthenticatedUser } from "@budget-terry/types";
import type { LoginInput, RegisterInput } from "@budget-terry/validation";
import { seedDefaultCategories } from "../categories/default-categories";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
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
  return { id: user.id, email: user.email, displayName: user.displayName };
}
