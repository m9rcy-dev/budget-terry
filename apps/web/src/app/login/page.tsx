"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@budget-terry/api-client";
import {
  loginSchema,
  requestLoginCodeSchema,
  type LoginInput,
  type RequestLoginCodeInput,
} from "@budget-terry/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Field, Input } from "../../components/Field";
import { useAuth } from "../../lib/auth-context";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
type CodeInput = z.infer<typeof codeSchema>;

type Mode = "code-request" | "code-verify" | "password";

/**
 * Passwordless email code is the primary path — password login still
 * works, reachable via the "Log in with password instead" link, not
 * removed. Three small forms (one per mode) rather than one dynamic
 * schema, since each step validates something genuinely different.
 */
export default function LoginPage() {
  const { login, requestLoginCode, loginWithCode } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code-request");
  const [codeEmail, setCodeEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const requestForm = useForm<RequestLoginCodeInput>({
    resolver: zodResolver(requestLoginCodeSchema),
  });
  const codeForm = useForm<CodeInput>({ resolver: zodResolver(codeSchema) });
  const passwordForm = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const switchMode = (next: Mode): void => {
    setErrorMessage(null);
    setInfoMessage(null);
    setMode(next);
  };

  const onRequestCode = async (values: RequestLoginCodeInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await requestLoginCode(values.email);
      setCodeEmail(values.email);
      codeForm.reset();
      setMode("code-verify");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? "Could not send a code right now. Try again shortly."
          : "Could not reach the server. Is the API running?",
      );
    }
  };

  const onVerifyCode = async (values: CodeInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await loginWithCode(codeEmail, values.code);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? "That code is invalid or has expired."
          : "Could not reach the server. Is the API running?",
      );
    }
  };

  const onResend = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await requestLoginCode(codeEmail);
      setInfoMessage("Sent a new code.");
    } catch {
      setErrorMessage("Could not reach the server. Is the API running?");
    }
  };

  const onPasswordLogin = async (values: LoginInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await login(values);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? "Invalid email or password."
          : "Could not reach the server. Is the API running?",
      );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Log in</h1>

        {mode === "code-request" && (
          <form onSubmit={requestForm.handleSubmit(onRequestCode)} className="flex flex-col gap-4">
            <Field
              label="Email"
              htmlFor="email"
              error={requestForm.formState.errors.email?.message}
            >
              <Input id="email" type="email" {...requestForm.register("email")} />
            </Field>
            {errorMessage && <ErrorState message={errorMessage} />}
            <Button type="submit" disabled={requestForm.formState.isSubmitting}>
              {requestForm.formState.isSubmitting ? "Sending code..." : "Send code"}
            </Button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Log in with password instead
            </button>
          </form>
        )}

        {mode === "code-verify" && (
          <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-text-primary">{codeEmail}</span>.
            </p>
            <Field label="Code" htmlFor="code" error={codeForm.formState.errors.code?.message}>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                {...codeForm.register("code")}
              />
            </Field>
            {errorMessage && <ErrorState message={errorMessage} />}
            {infoMessage && <p className="text-sm text-financial-positive">{infoMessage}</p>}
            <Button type="submit" disabled={codeForm.formState.isSubmitting}>
              {codeForm.formState.isSubmitting ? "Verifying..." : "Verify code"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => switchMode("code-request")}
                className="text-accent-primary underline underline-offset-2"
              >
                Use a different email
              </button>
              <button
                type="button"
                onClick={onResend}
                className="text-text-secondary underline underline-offset-2"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {mode === "password" && (
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordLogin)}
            className="flex flex-col gap-4"
          >
            <Field
              label="Email"
              htmlFor="email"
              error={passwordForm.formState.errors.email?.message}
            >
              <Input id="email" type="email" {...passwordForm.register("email")} />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              error={passwordForm.formState.errors.password?.message}
            >
              <Input id="password" type="password" {...passwordForm.register("password")} />
            </Field>

            {errorMessage && <ErrorState message={errorMessage} />}

            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? "Logging in..." : "Log in"}
            </Button>

            <button
              type="button"
              onClick={() => switchMode("code-request")}
              className="text-sm text-accent-primary underline underline-offset-2"
            >
              Log in with a code instead
            </button>
          </form>
        )}

        <p className="text-sm text-text-secondary">
          No account?{" "}
          <Link href="/register" className="text-accent-primary underline underline-offset-2">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
