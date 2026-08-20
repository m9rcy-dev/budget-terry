import { StyleSheet, Text } from "react-native";
import { colors } from "@budget-terry/ui";

export function EmptyState({ message }: { message: string }) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 14, color: colors.textSecondary },
});
