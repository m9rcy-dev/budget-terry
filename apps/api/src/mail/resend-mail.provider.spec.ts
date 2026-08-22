import type { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { ResendMailProvider } from "./resend-mail.provider";

const sendMock = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

function fakeConfigService(): ConfigService<Env, true> {
  return {
    get: (key: string) => {
      if (key === "RESEND_API_KEY") return "test-key";
      if (key === "MAIL_FROM") return "Budget Terry <no-reply@budgetterry.local>";
      throw new Error(`unexpected config key: ${key}`);
    },
  } as unknown as ConfigService<Env, true>;
}

describe("ResendMailProvider", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("sends the message via the Resend client", async () => {
    sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const provider = new ResendMailProvider(fakeConfigService());

    await provider.send({
      to: "person@example.com",
      subject: "Your code",
      text: "042817",
      html: "<p>042817</p>",
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: "Budget Terry <no-reply@budgetterry.local>",
      to: "person@example.com",
      subject: "Your code",
      text: "042817",
      html: "<p>042817</p>",
    });
  });

  it("throws when Resend returns an error instead of raising", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `to` field" },
    });
    const provider = new ResendMailProvider(fakeConfigService());

    await expect(
      provider.send({ to: "bad", subject: "s", text: "t", html: "<p>t</p>" }),
    ).rejects.toThrow("Invalid `to` field");
  });
});
