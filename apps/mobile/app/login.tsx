import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@budget-terry/api-client";
import {
  loginSchema,
  requestLoginCodeSchema,
  type LoginInput,
  type RequestLoginCodeInput,
} from "@budget-terry/validation";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { colors, spacing } from "@budget-terry/ui";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
type CodeInput = z.infer<typeof codeSchema>;

type Mode = "code-request" | "code-verify" | "password";

/**
 * Same passwordless-first flow as apps/web/src/app/login/page.tsx — see
 * that file's comment for why three small forms instead of one.
 */
export default function LoginScreen() {
  const { login, requestLoginCode, loginWithCode } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("code-request");
  const [codeEmail, setCodeEmail] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
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
          : "The server may be waking up after being idle — please try again in a few seconds.",
      );
    }
  };

  const onVerifyCode = async (values: CodeInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await loginWithCode(codeEmail, values.code, rememberDevice);
      router.replace("/");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? "That code is invalid or has expired."
          : "The server may be waking up after being idle — please try again in a few seconds.",
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
      setErrorMessage(
        "The server may be waking up after being idle — please try again in a few seconds.",
      );
    }
  };

  const onPasswordLogin = async (values: LoginInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await login(values);
      router.replace("/");
    } catch {
      setErrorMessage("Invalid email or password.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>

      {mode === "code-request" && (
        <>
          <Controller
            control={requestForm.control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          {requestForm.formState.errors.email && (
            <ErrorState message={requestForm.formState.errors.email.message ?? "Invalid email."} />
          )}
          {errorMessage && <ErrorState message={errorMessage} />}
          <Button
            onPress={requestForm.handleSubmit(onRequestCode)}
            disabled={requestForm.formState.isSubmitting}
          >
            {requestForm.formState.isSubmitting ? "Sending code..." : "Send code"}
          </Button>
          <Pressable onPress={() => switchMode("password")}>
            <Text style={styles.link}>Log in with password instead</Text>
          </Pressable>
        </>
      )}

      {mode === "code-verify" && (
        <>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to <Text style={styles.subtitleEmphasis}>{codeEmail}</Text>.
          </Text>
          <Controller
            control={codeForm.control}
            name="code"
            render={({ field }) => (
              <TextField
                label="Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          {codeForm.formState.errors.code && (
            <ErrorState message={codeForm.formState.errors.code.message ?? "Invalid code."} />
          )}
          <View style={styles.rememberRow}>
            <Switch
              value={rememberDevice}
              onValueChange={setRememberDevice}
              trackColor={{ true: colors.accentPrimary }}
            />
            <Text style={styles.rememberLabel}>
              Remember this device — skip this step next time
            </Text>
          </View>
          {errorMessage && <ErrorState message={errorMessage} />}
          {infoMessage && <Text style={styles.info}>{infoMessage}</Text>}
          <Button
            onPress={codeForm.handleSubmit(onVerifyCode)}
            disabled={codeForm.formState.isSubmitting}
          >
            {codeForm.formState.isSubmitting ? "Verifying..." : "Verify code"}
          </Button>
          <View style={styles.row}>
            <Pressable onPress={() => switchMode("code-request")}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
            <Pressable onPress={onResend}>
              <Text style={styles.linkMuted}>Resend code</Text>
            </Pressable>
          </View>
        </>
      )}

      {mode === "password" && (
        <>
          <Controller
            control={passwordForm.control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          {passwordForm.formState.errors.email && (
            <ErrorState message={passwordForm.formState.errors.email.message ?? "Invalid email."} />
          )}

          <Controller
            control={passwordForm.control}
            name="password"
            render={({ field }) => (
              <TextField
                label="Password"
                placeholder="Password"
                secureTextEntry
                onChangeText={field.onChange}
                value={field.value}
              />
            )}
          />
          {passwordForm.formState.errors.password && (
            <ErrorState
              message={passwordForm.formState.errors.password.message ?? "Invalid password."}
            />
          )}

          {errorMessage && <ErrorState message={errorMessage} />}

          <Button
            onPress={passwordForm.handleSubmit(onPasswordLogin)}
            disabled={passwordForm.formState.isSubmitting}
          >
            {passwordForm.formState.isSubmitting ? "Logging in..." : "Log in"}
          </Button>
          <Pressable onPress={() => switchMode("code-request")}>
            <Text style={styles.link}>Log in with a code instead</Text>
          </Pressable>
        </>
      )}

      <Link href="/register" style={styles.link}>
        No account? Register
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: 13, color: colors.textSecondary },
  subtitleEmphasis: { fontWeight: "600", color: colors.textPrimary },
  info: { fontSize: 13, color: colors.financialPositive },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 4 },
  rememberLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  link: {
    marginTop: spacing.sm,
    textAlign: "center",
    textDecorationLine: "underline",
    color: colors.accentPrimary,
  },
  linkMuted: {
    textAlign: "center",
    textDecorationLine: "underline",
    color: colors.textSecondary,
  },
});
