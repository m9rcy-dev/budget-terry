import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors } from "@budget-terry/ui";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    // Required by react-native-gesture-handler (used by the drawer nav in
    // app/(app)/_layout.tsx) — must wrap the whole app, not just the
    // drawer, per the library's own setup docs.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
