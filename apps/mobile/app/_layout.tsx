import { Stack } from "expo-router";
import { colors } from "@budget-terry/ui";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* Native header hidden — every screen renders its own title/nav via
          the shared Screen component instead (plan Section 75: navigation
          consistency), so a second title bar would just be redundant. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AuthProvider>
  );
}
