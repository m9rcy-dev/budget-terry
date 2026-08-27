import type { GoalContribution } from "@budget-terry/types";
import { colors } from "@budget-terry/ui";
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
    <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT + 24 }}>
      {recent.map((contribution) => {
        const barHeight = Math.max(4, (contribution.amountMinorUnits / max) * CHART_HEIGHT);
        return (
          <div key={contribution.id} className="flex w-9 flex-col items-center gap-1">
            <div
              className="w-5 rounded-sm"
              style={{ height: barHeight, backgroundColor: colors.accentPrimary }}
              title={`$${minorUnitsToDollars(contribution.amountMinorUnits)} on ${contribution.contributionDate.slice(0, 10)}`}
            />
            <span className="whitespace-nowrap text-[10px] text-text-secondary">
              {contribution.contributionDate.slice(5, 10)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
