import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@budget-terry/ui";

const SIZE = 96;
const STROKE_WIDTH = 10;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function minorUnitsToDollars(value: number): string {
  return (value / 100).toFixed(2);
}

/** A filled arc showing percentage complete, with the amount remaining as the headline — replaces the old linear bar. */
export function GoalProgressRing({
  percentageComplete,
  remainingMinorUnits,
}: {
  percentageComplete: number;
  remainingMinorUnits: number;
}) {
  const clamped = Math.min(100, Math.max(0, percentageComplete));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.border}
          strokeWidth={STROKE_WIDTH}
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.accentPrimary}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View>
        <Text style={styles.remaining}>${minorUnitsToDollars(remainingMinorUnits)}</Text>
        <Text style={styles.caption}>remaining · {clamped}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12 },
  remaining: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
});
