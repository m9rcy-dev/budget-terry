import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { MailService } from "../mail/mail.service";
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
    loginCode: {
      findFirst: jest.fn(),
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
    generateLoginCode: jest.fn(() => ({
      code: "042817",
      codeHash: "042817-hash",
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),
    hashLoginCode: jest.fn((code: string) => `${code}-hash`),
  };
  const mailService = {
    sendLoginCode: jest.fn(),
  };

  const authService = new AuthService(
    prisma as unknown as PrismaService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    mailService as unknown as MailService,
  );

  return { authService, prisma, passwordService, tokenService, mailService };
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

  describe("requestLoginCode", () => {
    it("generates, stores, and emails a code when the email has an account", async () => {
      const { authService, prisma, mailService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "person@example.com",
        displayName: "Person",
      });

      await authService.requestLoginCode("person@example.com");

      expect(prisma.loginCode.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", consumedAt: null },
        data: { consumedAt: expect.any(Date) },
      });
      expect(prisma.loginCode.create).toHaveBeenCalledWith({
        data: { userId: "user-1", codeHash: "042817-hash", expiresAt: expect.any(Date) },
      });
      expect(mailService.sendLoginCode).toHaveBeenCalledWith("person@example.com", "042817");
    });

    it("does nothing (no code, no email) for an unknown address, without revealing that", async () => {
      const { authService, prisma, mailService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.requestLoginCode("nobody@example.com")).resolves.toBeUndefined();

      expect(prisma.loginCode.create).not.toHaveBeenCalled();
      expect(mailService.sendLoginCode).not.toHaveBeenCalled();
    });
  });

  describe("verifyLoginCode", () => {
    it("issues tokens for a correct, unexpired, not-yet-locked-out code", async () => {
      const { authService, prisma, tokenService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "person@example.com",
        displayName: "Person",
      });
      prisma.loginCode.findFirst.mockResolvedValue({
        id: "code-1",
        codeHash: "042817-hash",
        attempts: 0,
      });
      tokenService.hashLoginCode.mockReturnValue("042817-hash");

      const result = await authService.verifyLoginCode("person@example.com", "042817");

      expect(prisma.loginCode.update).toHaveBeenCalledWith({
        where: { id: "code-1" },
        data: { consumedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe("access-token");
    });

    it("rejects an unknown email with the same generic message as a bad code", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.verifyLoginCode("nobody@example.com", "042817"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when there's no live (unconsumed, unexpired) code for the user", async () => {
      const { authService, prisma } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "person@example.com" });
      prisma.loginCode.findFirst.mockResolvedValue(null);

      await expect(
        authService.verifyLoginCode("person@example.com", "042817"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("increments attempts and rejects on a wrong code, without consuming it", async () => {
      const { authService, prisma, tokenService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "person@example.com" });
      prisma.loginCode.findFirst.mockResolvedValue({
        id: "code-1",
        codeHash: "042817-hash",
        attempts: 1,
      });
      tokenService.hashLoginCode.mockReturnValue("wrong-guess-hash");

      await expect(
        authService.verifyLoginCode("person@example.com", "999999"),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.loginCode.update).toHaveBeenCalledWith({
        where: { id: "code-1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("rejects once the code has already hit the max attempt count, even with the right code", async () => {
      const { authService, prisma, tokenService } = buildAuthService();
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "person@example.com" });
      prisma.loginCode.findFirst.mockResolvedValue({
        id: "code-1",
        codeHash: "042817-hash",
        attempts: 5,
      });
      tokenService.hashLoginCode.mockReturnValue("042817-hash");

      await expect(
        authService.verifyLoginCode("person@example.com", "042817"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.loginCode.update).not.toHaveBeenCalled();
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
