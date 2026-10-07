// Design tokens shared by the React Native apps and the React portal (MT §9).
// ui_kit never depends on core (MT §9.1). Replace these placeholder values with the
// colours of the old app (lib/shared/app_colors.dart) in S0-FE1-1.

export const palette = {
  primary: '#208AEF',
  primaryDark: '#1468B8',
  success: '#1E9E5A',
  warning: '#E08A00',
  danger: '#D93636',
  neutral0: '#FFFFFF',
  neutral100: '#F4F5F7',
  neutral300: '#C9CED6',
  neutral600: '#5E6673',
  neutral900: '#14171C',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: palette.neutral0,
  surface: palette.neutral100,
  text: palette.neutral900,
  textMuted: palette.neutral600,
  border: palette.neutral300,
  primary: palette.primary,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
};

export const darkColors: ThemeColors = {
  background: palette.neutral900,
  surface: '#1F232A',
  text: palette.neutral0,
  textMuted: palette.neutral300,
  border: '#323844',
  primary: palette.primary,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 4, md: 8, lg: 16, pill: 999 } as const;
export const fontSize = { caption: 12, body: 15, title: 20, headline: 28 } as const;

// Seat colours by state (MT §6). Never rely on colour alone: seat_map also draws a symbol (MT §22).
export const seatColors = {
  AVAILABLE: palette.primary,
  SELECTED: palette.success,
  LOCKED: palette.neutral300,
  SOLD: palette.neutral600,
  BLOCKED: palette.neutral900,
  HELD: palette.warning,
  CONFLICT: palette.danger,
} as const;

// Gate scan results (MT §23.3).
export const scanResultColors = {
  OK: palette.success,
  ALREADY_USED: palette.danger,
  WRONG_SESSION: palette.danger,
  WRONG_ZONE: palette.warning,
  REVOKED: palette.danger,
  INVALID_SIGNATURE: palette.danger,
  OUTSIDE_TIME: palette.warning,
} as const;
