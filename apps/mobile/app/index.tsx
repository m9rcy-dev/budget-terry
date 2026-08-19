import { useEffect } from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth-context";

export default function HomeScreen() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budget Terry</Text>
      <Text style={styles.subtitle}>
        Logged in as {user.displayName} ({user.email})
      </Text>
      <View style={styles.nav}>
        <Link href="/transactions" style={styles.navLink}>
          Transactions
        </Link>
        <Link href="/accounts" style={styles.navLink}>
          Accounts
        </Link>
        <Link href="/categories" style={styles.navLink}>
          Categories
        </Link>
      </View>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#70746F",
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  nav: { flexDirection: "row", gap: 16 },
  navLink: { textDecorationLine: "underline" },
});
