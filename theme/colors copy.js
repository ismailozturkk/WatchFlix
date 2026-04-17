/* ─────────────────────────────────────────────────────────────────────────────
 * WatchFlix — Advanced Theme System (V5 - Scalable & Clean)
 * ────────────────────────────────────────────────────────────────────────────*/

/* ─── 1. COLOR PALETTE (10 LEVEL SCALE) ──────────────────────────────────────*/
export const PALETTE = {
  white: "#FFFFFF",
  black: "#000000",

  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2933",
    900: "#111827",
  },

  blue: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
  },

  green: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
    800: "#065F46",
    900: "#064E3B",
  },

  red: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
  },

  orange: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316",
    600: "#EA580C",
    700: "#C2410C",
    800: "#9A3412",
    900: "#7C2D12",
  },

  purple: {
    50: "#F5F3FF",
    100: "#EDE9FE",
    200: "#DDD6FE",
    300: "#C4B5FD",
    400: "#A78BFA",
    500: "#8B5CF6",
    600: "#7C3AED",
    700: "#6D28D9",
    800: "#5B21B6",
    900: "#4C1D95",
  },

  teal: {
    50: "#F0FDFA",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6",
    600: "#0D9488",
    700: "#0F766E",
    800: "#115E59",
    900: "#134E4A",
  },
};

/* ─── 2. OPACITY HELPER ─────────────────────────────────────────────────────*/
export const alpha = (hex, a = 1) => {
  if (!hex) return hex;
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/* ─── 3. THEME FACTORY ──────────────────────────────────────────────────────*/
const createTheme = ({ background, text, primary }) => ({
  bg: background,
  text,
  primary,

  border: alpha(text.primary, 0.15),
  shadow: alpha("#000", 0.25),

  semantic: {
    success: PALETTE.green[500],
    danger: PALETTE.red[500],
    warning: PALETTE.orange[500],
    info: PALETTE.blue[500],
  },
});

/* ─── 4. BASE THEMES ────────────────────────────────────────────────────────*/

// DARK
const darkBg = {
  level1: PALETTE.gray[900],
  level2: PALETTE.gray[800],
  level3: PALETTE.gray[700],
  level4: PALETTE.gray[600],
  level5: PALETTE.gray[500],
};

const darkText = {
  primary: PALETTE.white,
  secondary: PALETTE.gray[300],
  tertiary: PALETTE.gray[400],
  muted: PALETTE.gray[500],
  disabled: PALETTE.gray[600],
};

// LIGHT
const lightBg = {
  level1: PALETTE.gray[50],
  level2: PALETTE.gray[100],
  level3: PALETTE.gray[200],
  level4: PALETTE.gray[300],
  level5: PALETTE.gray[400],
};

const lightText = {
  primary: PALETTE.gray[900],
  secondary: PALETTE.gray[700],
  tertiary: PALETTE.gray[600],
  muted: PALETTE.gray[500],
  disabled: PALETTE.gray[400],
};

// BLUE
const blueBg = {
  level1: PALETTE.blue[900],
  level2: PALETTE.blue[800],
  level3: PALETTE.blue[700],
  level4: PALETTE.blue[600],
  level5: PALETTE.blue[500],
};

const blueText = {
  primary: PALETTE.blue[50],
  secondary: PALETTE.blue[200],
  tertiary: PALETTE.blue[300],
  muted: PALETTE.blue[400],
  disabled: PALETTE.blue[500],
};

// GREEN (TEAL)
const greenBg = {
  level1: PALETTE.teal[900],
  level2: PALETTE.teal[800],
  level3: PALETTE.teal[700],
  level4: PALETTE.teal[600],
  level5: PALETTE.teal[500],
};

const greenText = {
  primary: PALETTE.teal[50],
  secondary: PALETTE.teal[200],
  tertiary: PALETTE.teal[300],
  muted: PALETTE.teal[400],
  disabled: PALETTE.teal[500],
};

/* ─── 5. THEMES EXPORT ─────────────────────────────────────────────────────*/
export const themes = {
  dark: createTheme({
    background: darkBg,
    text: darkText,
    primary: PALETTE.blue[500],
  }),

  light: createTheme({
    background: lightBg,
    text: lightText,
    primary: PALETTE.blue[600],
  }),

  blue: createTheme({
    background: blueBg,
    text: blueText,
    primary: PALETTE.blue[400],
  }),

  green: createTheme({
    background: greenBg,
    text: greenText,
    primary: PALETTE.teal[400],
  }),
};

/* ─── 6. HELPERS ────────────────────────────────────────────────────────────*/

export const getTheme = (name) => themes[name] ?? themes.dark;

export const THEME_NAMES = Object.keys(themes);

/* Dot notation access (bg.level1 vs) */
export const getToken = (themeName, path) => {
  const theme = getTheme(themeName);
  return path.split(".").reduce((obj, key) => obj?.[key], theme);
};

/* ─── 7. STYLE MAPPING ─────────────────────────────────────────────────────*/

export const themeMap = {
  container: { backgroundColor: "bg.level1" },

  card: {
    backgroundColor: "bg.level2",
    borderColor: "border",
  },

  modal: {
    backgroundColor: "bg.level3",
  },

  text: { color: "text.primary" },
  textSecondary: { color: "text.secondary" },
  textMuted: { color: "text.muted" },

  buttonPrimary: {
    backgroundColor: "primary",
  },

  buttonText: {
    color: "text.primary",
  },
};

/* Apply theme to style */
export const applyTheme = (themeName, key) => {
  const map = themeMap[key];
  if (!map) return {};

  const out = {};
  Object.entries(map).forEach(([styleKey, tokenPath]) => {
    out[styleKey] = getToken(themeName, tokenPath);
  });

  return out;
};

/* ─── 8. DEFAULT EXPORT ─────────────────────────────────────────────────────*/
export default {
  PALETTE,
  themes,
  getTheme,
  getToken,
  applyTheme,
  alpha,
};
