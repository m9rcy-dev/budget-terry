import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, spacing } from "@budget-terry/ui";

interface TextFieldProps extends TextInputProps {
  label?: string;
}

/** Consistent input styling — label optional since some fields (e.g. quick-entry chips) don't need one. */
export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...props}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: 12, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
