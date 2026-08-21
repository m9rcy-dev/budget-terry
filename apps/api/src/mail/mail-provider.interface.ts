export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * The app never talks to an SMTP client, an HTTP email API, or any
 * provider-specific SDK directly — every call goes through this
 * interface. Swapping providers (Mailpit locally, MailerLite in
 * production, anything else later) means adding/selecting an
 * implementation in mail.module.ts, never touching a caller.
 */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = Symbol("MAIL_PROVIDER");
