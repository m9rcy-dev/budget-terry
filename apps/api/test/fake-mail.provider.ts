import type { MailMessage, MailProvider } from "../src/mail/mail-provider.interface";

/**
 * Test double for MailProvider — integration tests must not depend on a
 * real SMTP server (Mailpit or otherwise) being reachable, and this is
 * also the only way tests can observe the plaintext login code at all:
 * the database only ever stores its hash (see LoginCode in
 * schema.prisma), by design.
 */
export class FakeMailProvider implements MailProvider {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Pulls the 6-digit code out of the most recently sent message's text body. */
  latestCode(): string {
    const last = this.sent[this.sent.length - 1];
    if (!last) {
      throw new Error("FakeMailProvider: no mail has been sent yet");
    }
    const match = /\d{6}/.exec(last.text);
    if (!match) {
      throw new Error(`FakeMailProvider: no 6-digit code found in: ${last.text}`);
    }
    return match[0];
  }
}
