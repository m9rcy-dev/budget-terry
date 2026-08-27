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
    <div className="flex items-center gap-3">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.border}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.accentPrimary}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div>
        <p className="tabular-nums text-lg font-semibold text-text-primary">
          ${minorUnitsToDollars(remainingMinorUnits)}
        </p>
        <p className="text-xs text-text-secondary">remaining · {clamped}%</p>
      </div>
    </div>
  );
}
