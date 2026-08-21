import Svg, { Circle, Line, Polygon, Polyline, Rect } from "react-native-svg";

/**
 * Same icon set/shapes as apps/web/src/components/icons.tsx, ported to
 * react-native-svg primitives — kept visually identical across platforms
 * deliberately (plan Section 75: navigation consistency).
 */
interface IconProps {
  size?: number;
  color?: string;
}

const strokeProps = {
  fill: "none",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="3" y="3" width="6" height="6" rx="1.4" stroke={color} {...strokeProps} />
      <Rect x="11" y="3" width="6" height="6" rx="1.4" stroke={color} {...strokeProps} />
      <Rect x="3" y="11" width="6" height="6" rx="1.4" stroke={color} {...strokeProps} />
      <Rect x="11" y="11" width="6" height="6" rx="1.4" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function TransactionsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Line x1="4" y1="6" x2="16" y2="6" stroke={color} {...strokeProps} />
      <Polyline points="12,2 16,6 12,10" stroke={color} {...strokeProps} />
      <Line x1="16" y1="14" x2="4" y2="14" stroke={color} {...strokeProps} />
      <Polyline points="8,10 4,14 8,18" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function AccountsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="2" y="5" width="16" height="11" rx="2" stroke={color} {...strokeProps} />
      <Line x1="2" y1="9" x2="18" y2="9" stroke={color} {...strokeProps} />
      <Circle cx="14" cy="12.5" r="1.1" fill={color} />
    </Svg>
  );
}

export function CategoriesIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Polygon points="2,3 11,3 18,10 11,17 2,17" stroke={color} {...strokeProps} />
      <Circle cx="6.5" cy="10" r="1.3" fill={color} />
    </Svg>
  );
}

export function BudgetsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="7" stroke={color} {...strokeProps} />
      <Line x1="10" y1="10" x2="10" y2="3" stroke={color} {...strokeProps} />
      <Line x1="10" y1="10" x2="15.2" y2="13.8" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function BillsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="4" y="2" width="12" height="16" rx="1" stroke={color} {...strokeProps} />
      <Line x1="7" y1="6.5" x2="13" y2="6.5" stroke={color} {...strokeProps} />
      <Line x1="7" y1="10" x2="13" y2="10" stroke={color} {...strokeProps} />
      <Line x1="7" y1="13.5" x2="11" y2="13.5" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function CalendarIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="3" y="4" width="14" height="13" rx="1.5" stroke={color} {...strokeProps} />
      <Line x1="3" y1="8" x2="17" y2="8" stroke={color} {...strokeProps} />
      <Line x1="7" y1="2" x2="7" y2="5" stroke={color} {...strokeProps} />
      <Line x1="13" y1="2" x2="13" y2="5" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function GoalsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Line x1="4" y1="3" x2="4" y2="17" stroke={color} {...strokeProps} />
      <Polygon points="4,3 16,3 12,7 16,11 4,11" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function AnalyticsIcon({ size = 18, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="3" y="10" width="3.2" height="7" rx="1" fill={color} />
      <Rect x="8.4" y="6" width="3.2" height="11" rx="1" fill={color} />
      <Rect x="13.8" y="2" width="3.2" height="15" rx="1" fill={color} />
    </Svg>
  );
}

export function LogoutIcon({ size = 16, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="3" y="3" width="8" height="14" rx="1.4" stroke={color} {...strokeProps} />
      <Line x1="8" y1="10" x2="17" y2="10" stroke={color} {...strokeProps} />
      <Polyline points="14,7 17,10 14,13" stroke={color} {...strokeProps} />
    </Svg>
  );
}

export function MenuIcon({ size = 20, color = "#202220" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Line x1="3" y1="6" x2="17" y2="6" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1="3" y1="10" x2="17" y2="10" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1="3" y1="14" x2="17" y2="14" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}
