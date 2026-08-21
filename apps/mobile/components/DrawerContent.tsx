import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@budget-terry/ui";
import { useAuth } from "../lib/auth-context";
import {
  AccountsIcon,
  AnalyticsIcon,
  BillsIcon,
  BudgetsIcon,
  CalendarIcon,
  CategoriesIcon,
  DashboardIcon,
  GoalsIcon,
  LogoutIcon,
  TransactionsIcon,
} from "./icons";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/transactions", label: "Transactions", Icon: TransactionsIcon },
  { href: "/accounts", label: "Accounts", Icon: AccountsIcon },
  { href: "/categories", label: "Categories", Icon: CategoriesIcon },
  { href: "/budgets", label: "Budgets", Icon: BudgetsIcon },
  { href: "/bills", label: "Bills", Icon: BillsIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/goals", label: "Goals", Icon: GoalsIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Same nav list/icons/account footer as the web sidebar's drawer (plan
 * Section 75: navigation consistency) — replaces Screen.tsx's horizontal
 * nav-chip row.
 */
export function DrawerContent({ navigation }: DrawerContentComponentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const onNavigate = (href: string): void => {
    router.push(href);
    navigation.closeDrawer();
  };

  const onLogout = async (): Promise<void> => {
    navigation.closeDrawer();
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.root}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>B</Text>
        </View>
        <Text style={styles.logoWord}>Budget Terry</Text>
      </View>

      <ScrollView contentContainerStyle={styles.nav}>
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Pressable
              key={href}
              onPress={() => onNavigate(href)}
              accessibilityRole="link"
              accessibilityState={{ selected: isActive }}
              style={[styles.item, isActive && styles.itemActive]}
            >
              <Icon size={17} color={isActive ? colors.accentPrimary : colors.textSecondary} />
              <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {user && (
        <View style={styles.footer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.displayName)}</Text>
          </View>
          <View style={styles.footerText}>
            <Text style={styles.footerName} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text style={styles.footerEmail} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <Pressable onPress={onLogout} accessibilityLabel="Log out" style={styles.logoutButton}>
            <LogoutIcon size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: spacing.md },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
  logoWord: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.2 },
  nav: { gap: 2, paddingBottom: spacing.md },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: `${colors.accentPrimary}1A` },
  itemText: { fontSize: 13.5, fontWeight: "500", color: colors.textSecondary },
  itemTextActive: { color: colors.accentPrimary, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 11, fontWeight: "700", color: colors.accentPrimary },
  footerText: { flex: 1, minWidth: 0 },
  footerName: { fontSize: 12.5, fontWeight: "600", color: colors.textPrimary },
  footerEmail: { fontSize: 11, color: colors.textSecondary },
  logoutButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
