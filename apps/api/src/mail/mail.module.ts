import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";
import { MAIL_PROVIDER } from "./mail-provider.interface";
import { MailService } from "./mail.service";
import { SmtpMailProvider } from "./smtp-mail.provider";

@Module({
  providers: [
    SmtpMailProvider,
    {
      provide: MAIL_PROVIDER,
      useFactory: (configService: ConfigService<Env, true>, smtp: SmtpMailProvider) => {
        const provider = configService.get("MAIL_PROVIDER", { infer: true });
        switch (provider) {
          case "smtp":
            return smtp;
          default: {
            // Exhaustiveness check: fails to compile if MAIL_PROVIDER's
            // union in env.ts ever grows without a case added here.
            const unreachable: never = provider;
            throw new Error(`Unknown MAIL_PROVIDER: ${String(unreachable)}`);
          }
        }
      },
      inject: [ConfigService, SmtpMailProvider],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
