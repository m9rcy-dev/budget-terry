import type { SVGProps } from "react";

/**
 * Small hand-built icon set for the sidebar/drawer nav — matches the
 * approved design mockup exactly (rect/line/circle/polygon primitives,
 * no icon library dependency). `currentColor` throughout so each icon
 * inherits the active/inactive text color of its nav item.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" />
      <rect x="3" y="11" width="6" height="6" rx="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" />
    </svg>
  );
}

export function TransactionsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="6" x2="16" y2="6" />
      <polyline points="12,2 16,6 12,10" />
      <line x1="16" y1="14" x2="4" y2="14" />
      <polyline points="8,10 4,14 8,18" />
    </svg>
  );
}

export function AccountsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <line x1="2" y1="9" x2="18" y2="9" />
      <circle cx="14" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CategoriesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polygon points="2,3 11,3 18,10 11,17 2,17" fill="none" />
      <circle cx="6.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BudgetsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="10" cy="10" r="7" />
      <line x1="10" y1="10" x2="10" y2="3" />
      <line x1="10" y1="10" x2="15.2" y2="13.8" />
    </svg>
  );
}

export function BillsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="2" width="12" height="16" rx="1" />
      <line x1="7" y1="6.5" x2="13" y2="6.5" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13.5" x2="11" y2="13.5" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="7" y1="2" x2="7" y2="5" />
      <line x1="13" y1="2" x2="13" y2="5" />
    </svg>
  );
}

export function GoalsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="4" y1="3" x2="4" y2="17" />
      <polygon points="4,3 16,3 12,7 16,11 4,11" fill="none" />
    </svg>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <svg {...base} {...props} strokeWidth={0}>
      <rect x="3" y="10" width="3.2" height="7" rx="1" fill="currentColor" />
      <rect x="8.4" y="6" width="3.2" height="11" rx="1" fill="currentColor" />
      <rect x="13.8" y="2" width="3.2" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      {...props}
    >
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="14" x2="17" y2="14" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      {...props}
    >
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="8" height="14" rx="1.4" />
      <line x1="8" y1="10" x2="17" y2="10" />
      <polyline points="14,7 17,10 14,13" />
    </svg>
  );
}
