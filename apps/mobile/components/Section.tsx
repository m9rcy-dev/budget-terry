import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@budget-terry/ui";

/** Warm Ledger's default content container — a hairline border rather than a heavy shadowed card. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
});
