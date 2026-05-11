import { forgeDark } from './forge-dark';
import { forgeLight } from './forge-light';
import { dracula } from './dracula';
import { oneDark } from './one-dark';
import { solarizedDark } from './solarized-dark';
import { highContrast } from './high-contrast';

export type { ForgeTheme } from './types';

export const THEME_REGISTRY = {
  'forge-dark': forgeDark,
  'forge-light': forgeLight,
  'dracula': dracula,
  'one-dark': oneDark,
  'solarized-dark': solarizedDark,
  'high-contrast': highContrast,
} as const;

export const DEFAULT_THEME = 'forge-dark' as const;

export type ThemeName = keyof typeof THEME_REGISTRY;
