import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { Env } from "../config/env";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

/**
 * Production provider, selected via MAIL_PROVIDER=resend. Uses Resend's
 * HTTP API (not SMTP) — the vendor's own recommended integration path,
 * and it avoids relying on outbound SMTP ports being open on the host.
 * A transactional-email API, unlike MailerLite (marketing-oriented),
 * which this project deliberately did not use for login codes.
 */
@Injectable()
export class ResendMailProvider implements MailProvider {
  private client: Resend | undefined;
  private readonly apiKey: string;
  private readonly from: string;

  constructor(configService: ConfigService<Env, true>) {
    this.apiKey = configService.get("RESEND_API_KEY", { infer: true });
    this.from = configService.get("MAIL_FROM", { infer: true });
  }

  // Constructed lazily, not in the constructor: the Resend SDK throws
  // immediately on an empty API key, but this provider is registered
  // (and so eagerly instantiated by Nest) even when MAIL_PROVIDER=smtp
  // is actually selected — the common case in dev/test, where
  // RESEND_API_KEY is unset. Only fails once this provider is actually used.
  private getClient(): Resend {
    this.client ??= new Resend(this.apiKey);
    return this.client;
  }

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.getClient().emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (error) {
      throw new Error(`Resend failed to send email: ${error.message}`);
    }
  }
}
