import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Env } from "../config/env";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

/**
 * Plain SMTP — deliberately the only provider implemented so far,
 * because it already covers both environments this project actually
 * needs: Mailpit locally (docker-compose, no auth) and MailerLite's SMTP
 * relay in production (ADR pending — see docs/architecture/security.md).
 * Switching provider is an env var change (SMTP_HOST/PORT/USER/PASSWORD),
 * not a code change. A future provider that only offers an HTTP API
 * (not SMTP) would get its own MailProvider implementation alongside
 * this one, selected in mail.module.ts.
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
