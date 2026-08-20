import type { ReactNode } from "react";
import { Link, usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@budget-terry/ui";
import { useAuth } from "../lib/auth-context";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/budgets", label: "Budgets" },
  { href: "/bills", label: "Bills" },
  { href: "/calendar", label: "Calendar" },
  { href: "/goals", label: "Goals" },
  { href: "/analytics", label: "Analytics" },
] as const;

/**
 * Shared header/nav/container for every authenticated screen. Before
 * this, only the Home screen had any cross-screen navigation — every
 * other screen relied on the native back gesture to return Home before
 * going anywhere else. This gives every screen the same quick-nav row
 * Home always had (plan Section 75: navigation consistency).
 */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const onLogout = async (): Promise<void> => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.nav}
        contentContainerStyle={styles.navContent}
      >
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} asChild>
              <Pressable
                style={[styles.navChip, isActive && styles.navChipActive]}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.navChipText, isActive && styles.navChipTextActive]}>
                  {link.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: "600", color: colors.textPrimary },
  logout: { fontSize: 13, color: colors.textSecondary, textDecorationLine: "underline" },
  nav: { marginTop: spacing.sm, flexGrow: 0 },
  navContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  navChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  navChipActive: { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
  navChipText: { fontSize: 12, color: colors.textSecondary },
  navChipTextActive: { color: "#FFFFFF" },
  content: { flex: 1 },
  contentInner: { padding: spacing.lg, gap: spacing.sm },
});
