import { StyleSheet, Text, View } from "react-native";
import { colors } from "@budget-terry/ui";

/** Pairs a colour indicator with a text label — colour is never the only state signal (plan Section 54/70). */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, color: colors.textSecondary },
});
