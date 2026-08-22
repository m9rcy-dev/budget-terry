import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@budget-terry/ui";

/** Shown while a fetch is in flight — previously screens rendered nothing during loading. */
export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accentPrimary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontSize: 14, color: colors.textSecondary },
});
