import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@budget-terry/validation";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@budget-terry/ui";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput): Promise<void> => {
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

      <Controller
        control={control}
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
      {errors.email && <ErrorState message={errors.email.message ?? "Invalid email."} />}

      <Controller
        control={control}
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
      {errors.password && <ErrorState message={errors.password.message ?? "Invalid password."} />}

      {errorMessage && <ErrorState message={errorMessage} />}

      <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>

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
  link: {
    marginTop: spacing.sm,
    textAlign: "center",
    textDecorationLine: "underline",
    color: colors.accentPrimary,
  },
});
