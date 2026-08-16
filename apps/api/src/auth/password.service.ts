import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/** argon2id — OWASP's current recommended default. See ADR-011. */
@Injectable()
export class PasswordService {
  hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, { type: argon2.argon2id });
  }

  verify(hash: string, plainText: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
