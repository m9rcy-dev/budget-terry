"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ApiError } from "@budget-terry/api-client";
import { registerSchema, type RegisterInput } from "@budget-terry/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/ErrorState";
import { Field, Input } from "../../components/Field";
import { useAuth } from "../../lib/auth-context";

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterInput): Promise<void> => {
    setErrorMessage(null);
    try {
      await registerUser(values);
      router.push("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? "Could not create an account with those details."
          : "Could not reach the server. Is the API running?",
      );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-xl font-semibold text-text-primary">Create an account</h1>

        <Field label="Name" htmlFor="displayName" error={errors.displayName?.message}>
          <Input id="displayName" {...register("displayName")} />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" {...register("password")} />
        </Field>

        {errorMessage && <ErrorState message={errorMessage} />}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-primary underline underline-offset-2">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
