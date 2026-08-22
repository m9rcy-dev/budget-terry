import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { registerSchema, type RegisterInput } from "@budget-terry/validation";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@budget-terry/ui";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await register(values);
      router.replace("/");
    } catch {
      setErrorMessage("Could not create an account with those details.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an account</Text>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Name"
            placeholder="Name"
            onChangeText={field.onChange}
            value={field.value}
          />
        )}
      />
      {errors.displayName && <ErrorState message={errors.displayName.message ?? "Invalid name."} />}

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
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      <Link href="/login" style={styles.link}>
        Already have an account? Log in
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
