// ANSI escape codes for styling
const ESC = '\x1b[';

export const colors = {
  reset: `${ESC}0m`,

  // Text colors
  black: `${ESC}30m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,

  // Bright colors
  brightRed: `${ESC}91m`,
  brightGreen: `${ESC}92m`,
  brightYellow: `${ESC}93m`,
  brightBlue: `${ESC}94m`,
  brightMagenta: `${ESC}95m`,
  brightCyan: `${ESC}96m`,
  brightWhite: `${ESC}97m`,
} as const;

export const style = {
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,
  inverse: `${ESC}7m`,
  strikethrough: `${ESC}9m`,
} as const;

export const cursor = {
  hide: `${ESC}?25l`,
  show: `${ESC}?25h`,
  up: (n = 1) => `${ESC}${n}A`,
  down: (n = 1) => `${ESC}${n}B`,
  forward: (n = 1) => `${ESC}${n}C`,
  back: (n = 1) => `${ESC}${n}D`,
  clearLine: `${ESC}2K`,
  clearDown: `${ESC}J`,
  moveToColumn: (n: number) => `${ESC}${n}G`,
  saveCursor: `${ESC}s`,
  restoreCursor: `${ESC}u`,
} as const;

export const erase = {
  line: `${ESC}2K`,
  lineEnd: `${ESC}K`,
  screen: `${ESC}2J`,
} as const;

// Semantic colors for the application
export const theme = {
  primary: colors.brightCyan,
  secondary: colors.brightMagenta,
  success: colors.brightGreen,
  warning: colors.brightYellow,
  error: colors.brightRed,
  info: colors.brightBlue,
  muted: colors.gray,
  accent: colors.cyan,
  tool: colors.yellow,
  prompt: colors.brightGreen,
  assistant: colors.brightCyan,
  code: colors.green,
} as const;
