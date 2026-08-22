import { Test, type TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };

  beforeEach(async () => {
    prisma.$queryRaw.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it("reports ok after successfully pinging the database", async () => {
    await expect(controller.check()).resolves.toEqual({ status: "ok" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("propagates a database failure rather than reporting false-positive health", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    await expect(controller.check()).rejects.toThrow("connection refused");
  });
});
