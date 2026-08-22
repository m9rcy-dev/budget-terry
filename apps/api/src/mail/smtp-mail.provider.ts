import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Env } from "../config/env";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

/**
 * Plain SMTP — used locally against Mailpit (docker-compose, no auth).
 * Production uses ResendMailProvider instead (Resend's HTTP API), since
 * Resend is the selected production provider — see mail.module.ts and
 * docs/architecture/security.md. Kept as a separate implementation
 * rather than removed: any future SMTP-only provider (or a self-hosted
 * relay) can reuse this without writing a new one.
 */
@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(configService: ConfigService<Env, true>) {
    const user = configService.get("SMTP_USER", { infer: true });
    const password = configService.get("SMTP_PASSWORD", { infer: true });

    this.transporter = nodemailer.createTransport({
      host: configService.get("SMTP_HOST", { infer: true }),
      port: configService.get("SMTP_PORT", { infer: true }),
      secure: configService.get("SMTP_SECURE", { infer: true }),
      // Mailpit needs no credentials; omit `auth` entirely rather than
      // sending empty-string user/pass, which some servers reject outright.
      auth: user && password ? { user, pass: password } : undefined,
    });
    this.from = configService.get("MAIL_FROM", { infer: true });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
