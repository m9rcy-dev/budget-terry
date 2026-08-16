import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import type { PasswordService } from "./password.service";
import type { TokenService } from "./token.service";

function buildAuthService() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    category: {
      upsert: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const passwordService = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  const tokenService = {
    signAccessToken: jest.fn(() => "access-token"),
    generateRefreshToken: jest.fn(() => ({
      token: "refresh-token",
      tokenHash: "refresh-token-hash",
      expiresAt: new Date(Date.now() + 1000),
    })),
    hashRefreshToken: jest.fn((token: string) => `${token}-hash`),
  };

  const authService = new AuthService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
  );

  return { authService, prisma, passwordService, tokenService };
}

describe("AuthService", () => {
  describe("register", () => {
    it("creates a user, seeds default categories, and issues tokens", async () => {
      const { authService, prisma, passwordService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue("hashed-password");
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "new@example.com",
        displayName: "New User",
      });

      const result = await authService.register({
        email: "new@example.com",
        password: "a-long-enough-password",
        displayName: "New User",
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          displayName: "New User",
          passwordHash: "hashed-password",
        },
      });
      expect(prisma.category.upsert).toHaveBeenCalledTimes(15);
      expect(result.user).toEqual({
        id: "user-1",
        email: "new@example.com",
        displayName: "New User",
      });
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
    });

    it("rejects registration when the email is already taken", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        authService.register({
          email: "taken@example.com",
          password: "a-long-enough-password",
          displayName: "X",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("issues tokens for a correct password", async () => {
      const { authService, prisma, passwordService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "person@example.com",
        displayName: "Person",
        passwordHash: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(true);

      const result = await authService.login({ email: "person@example.com", password: "correct" });

      expect(result.accessToken).toBe("access-token");
    });

    it("rejects an unknown email with a generic message", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: "nobody@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an incorrect password", async () => {
      const { authService, prisma, passwordService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "person@example.com",
        displayName: "Person",
        passwordHash: "hashed-password",
      });
      passwordService.verify.mockResolvedValue(false);

      await expect(
        authService.login({ email: "person@example.com", password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("rotates the refresh token: revokes the old one and issues a new one", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "user-1",
        email: "person@example.com",
        displayName: "Person",
      });

      const result = await authService.refresh("some-refresh-token");

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "token-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
    });

    it("rejects an unknown refresh token", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(authService.refresh("unknown-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects a revoked refresh token", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });

      await expect(authService.refresh("revoked-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects an expired refresh token", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(authService.refresh("expired-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("revokes the matching, not-already-revoked refresh token", async () => {
      const { authService, prisma } = buildAuthService();

      await authService.logout("some-refresh-token");

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: "some-refresh-token-hash", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
