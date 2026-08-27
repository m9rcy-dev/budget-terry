import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@budget-terry/ui";
import { Button } from "./Button";

/** Shown in place of a list when its initial fetch fails — offers a retry instead of spinning forever. */
export function ListLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      <Button variant="secondary" onPress={onRetry}>
        Retry
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, alignItems: "flex-start" },
  text: { fontSize: 14, color: colors.financialNegative },
});
