import { StyleSheet, Text } from "react-native";
import { colors } from "@budget-terry/ui";

/** Shown when a fetch (not just a mutation) fails — distinct from EmptyState's "nothing here yet". */
export function ErrorState({ message }: { message: string }) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 14, color: colors.financialNegative },
});
