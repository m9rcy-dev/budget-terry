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

  /**
   * Best-effort, not critical-path — a failed send here must never fail
   * registration itself. Callers should catch, not propagate. No store/QR
   * download link yet: the app isn't published anywhere (docs/deployment.md),
   * so there's nothing real to link to today.
   */
  async sendWelcomeEmail(email: string, displayName: string): Promise<void> {
    await this.provider.send({
      to: email,
      subject: "Welcome to Budget Terry",
      text: `Hi ${displayName}, welcome to Budget Terry! To get started, add your first account — every transaction needs one to belong to. From there you can set up budgets, bills, and savings goals whenever you're ready.`,
      html: `<p>Hi ${displayName}, welcome to Budget Terry!</p><p>To get started, add your first account — every transaction needs one to belong to. From there you can set up budgets, bills, and savings goals whenever you're ready.</p>`,
    });
  }
}
