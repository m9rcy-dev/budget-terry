import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, spacing } from "@budget-terry/ui";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ variant = "primary", style, children, ...props }: ButtonProps) {
  return (
    <Pressable
      {...props}
      style={[styles.base, variant === "secondary" && styles.secondary, style as never]}
    >
      <Text style={[styles.text, variant === "secondary" && styles.secondaryText]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  secondaryText: { color: colors.textPrimary },
});
