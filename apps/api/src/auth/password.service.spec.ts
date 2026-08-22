import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes a password and verifies the same password against it", async () => {
    const hash = await service.hash("correct-horse-battery-staple");

    await expect(service.verify(hash, "correct-horse-battery-staple")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await service.hash("correct-horse-battery-staple");

    await expect(service.verify(hash, "wrong-password")).resolves.toBe(false);
  });

  it("salts each hash so the same password never produces the same hash twice", async () => {
    const hash1 = await service.hash("same-password");
    const hash2 = await service.hash("same-password");

    expect(hash1).not.toBe(hash2);
  });
});
