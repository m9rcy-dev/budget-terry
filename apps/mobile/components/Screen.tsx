import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { colors, spacing } from "@budget-terry/ui";

/**
 * Shared scrollable content container for every authenticated screen.
 * Header (title + hamburger to open the drawer) and navigation now live
 * in the Drawer navigator itself (app/(app)/_layout.tsx) and
 * DrawerContent — this just wraps page content, matching the pattern
 * every screen already used for its own body.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
});
