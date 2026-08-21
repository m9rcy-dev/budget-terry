import { Drawer } from "expo-router/drawer";
import { colors } from "@budget-terry/ui";
import { DrawerContent } from "../../components/DrawerContent";

/**
 * Replaces Screen.tsx's old horizontal nav-chip row with a real drawer —
 * same nav list/icons/account footer as the web sidebar (plan Section 75:
 * navigation consistency). Every screen keeps equal footing in one list
 * rather than picking a handful for a bottom tab bar.
 */
export default function AppLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "600", fontSize: 17 },
        headerShadowVisible: false,
        drawerStyle: { width: 264 },
      }}
    >
      <Drawer.Screen name="index" options={{ title: "Dashboard" }} />
      <Drawer.Screen name="transactions" options={{ title: "Transactions" }} />
      <Drawer.Screen name="accounts" options={{ title: "Accounts" }} />
      <Drawer.Screen name="categories" options={{ title: "Categories" }} />
      <Drawer.Screen name="budgets" options={{ title: "Budgets" }} />
      <Drawer.Screen name="bills" options={{ title: "Bills" }} />
      <Drawer.Screen name="calendar" options={{ title: "Calendar" }} />
      <Drawer.Screen name="goals" options={{ title: "Goals" }} />
      <Drawer.Screen name="analytics" options={{ title: "Analytics" }} />
    </Drawer>
  );
}
