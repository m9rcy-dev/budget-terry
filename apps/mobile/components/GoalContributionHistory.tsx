import { StyleSheet, Text, View } from "react-native";
import type { GoalContribution } from "@budget-terry/types";
import { colors, spacing } from "@budget-terry/ui";
import { EmptyState } from "./EmptyState";

const CHART_HEIGHT = 64;
const MAX_BARS = 8;

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

/** One bar per contribution, most recent MAX_BARS, oldest-first left-to-right. */
export function GoalContributionHistory({ contributions }: { contributions: GoalContribution[] }) {
  if (contributions.length === 0) {
    return <EmptyState message="No contributions yet." />;
  }

  // contributions arrive newest-first from the API — take the most recent
  // MAX_BARS, then reverse so the chart reads oldest-to-newest left-to-right.
  const recent = contributions.slice(0, MAX_BARS).slice().reverse();
  const max = Math.max(1, ...recent.map((contribution) => contribution.amountMinorUnits));

  return (
    <View style={styles.row}>
      {recent.map((contribution) => {
        const barHeight = Math.max(4, (contribution.amountMinorUnits / max) * CHART_HEIGHT);
        return (
          <View key={contribution.id} style={styles.bar}>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { height: barHeight }]}
                accessibilityLabel={`$${minorUnitsToDollars(contribution.amountMinorUnits)} on ${contribution.contributionDate.slice(0, 10)}`}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {contribution.contributionDate.slice(5, 10)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs + 2,
    height: CHART_HEIGHT + 20,
  },
  bar: { alignItems: "center", gap: 4, width: 36 },
  barTrack: { height: CHART_HEIGHT, justifyContent: "flex-end" },
  barFill: { width: 20, borderRadius: 3, backgroundColor: colors.accentPrimary },
  label: { fontSize: 10, color: colors.textSecondary },
});
