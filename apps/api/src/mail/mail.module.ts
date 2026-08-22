import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { MAIL_PROVIDER } from "./mail-provider.interface";
import { MailService } from "./mail.service";
import { ResendMailProvider } from "./resend-mail.provider";
import { SmtpMailProvider } from "./smtp-mail.provider";

@Module({
  providers: [
    SmtpMailProvider,
    ResendMailProvider,
    {
      provide: MAIL_PROVIDER,
      useFactory: (
        configService: ConfigService<Env, true>,
        smtp: SmtpMailProvider,
        resend: ResendMailProvider,
      ) => {
        const provider = configService.get("MAIL_PROVIDER", { infer: true });
        switch (provider) {
          case "smtp":
            return smtp;
          case "resend":
            return resend;
          default: {
            // Exhaustiveness check: fails to compile if MAIL_PROVIDER's
            // union in env.ts ever grows without a case added here.
            const unreachable: never = provider;
            throw new Error(`Unknown MAIL_PROVIDER: ${String(unreachable)}`);
          }
        }
      },
      inject: [ConfigService, SmtpMailProvider, ResendMailProvider],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
