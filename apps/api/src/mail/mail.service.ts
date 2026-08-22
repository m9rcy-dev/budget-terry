import { Inject, Injectable } from "@nestjs/common";
import { MAIL_PROVIDER, type MailProvider } from "./mail-provider.interface";

/**
 * Domain-level email content lives here, not in AuthService — the auth
 * layer asks for "send this person a login code," not "here's an SMTP
 * message." Keeps subject lines/copy in one place if a second email
 * (e.g. a future "your password changed" notice) is ever added.
 */
@Injectable()
export class MailService {
  constructor(@Inject(MAIL_PROVIDER) private readonly provider: MailProvider) {}

  async sendLoginCode(email: string, code: string): Promise<void> {
    await this.provider.send({
      to: email,
      subject: `${code} is your Budget Terry login code`,
      text: `Your Budget Terry login code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `<p>Your Budget Terry login code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    });
  }
}
