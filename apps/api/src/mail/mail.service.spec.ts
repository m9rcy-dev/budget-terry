import type { MailProvider } from "./mail-provider.interface";
import { MailService } from "./mail.service";

describe("MailService", () => {
  it("sends the login code to the given address, with the code in both text and html bodies", async () => {
    const provider: MailProvider = { send: jest.fn().mockResolvedValue(undefined) };
    const mailService = new MailService(provider);

    await mailService.sendLoginCode("person@example.com", "042817");

    expect(provider.send).toHaveBeenCalledTimes(1);
    const message = (provider.send as jest.Mock).mock.calls[0][0];
    expect(message.to).toBe("person@example.com");
    expect(message.subject).toContain("042817");
    expect(message.text).toContain("042817");
    expect(message.html).toContain("042817");
  });
});
