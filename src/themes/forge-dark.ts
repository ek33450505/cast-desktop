import type { ForgeTheme } from './types';

export const forgeDark: ForgeTheme = {
  name: 'forge-dark',
  displayName: 'Forge Dark',
  background: '#1a1008',        // terminal area — deep warm black
  foreground: '#e8dcc8',
  accent: '#e8a838',            // amber
  accentSoft: '#b05828',        // visible ember (was too dark at #8b4010)
  sidebar: '#261410',           // noticeably warmer/redder than terminal bg
  sidebarBorder: '#5a3020',     // visible warm border (was invisible #3a2218)
  titleBar: '#0e0906',
  titleBarText: '#e8dcc8',
  paneHeader: '#1a1008',
  paneHeaderActive: '#2e1a0a',  // visible active bg contrast
  paneHeaderText: '#e8dcc8',
  statusBar: '#0e0906',
  statusBarText: '#b89878',     // warm tan, not blue
  border: '#5a3020',            // visible (was invisible #3a2218)
  inputBackground: '#261410',
  inputText: '#e8dcc8',
  modalBackground: '#261410',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  claudeAccent: '#d070f0',
  claudeAccentBg: 'rgba(180,60,220,0.10)',
  separatorColor: '#3a2218',
  separatorHover: '#5a3020',
  tabBar: '#0e0906',
  tabActive: '#2e1a0a',
  tabInactive: '#1a1008',
  tabBorder: '#3a2218',
  tabCloseHover: 'rgba(232,168,56,0.2)',
  success: '#70a840',
  warning: '#e8a838',
  error: '#c05020',
  textMuted: '#b89878',
  textSubtle: '#6a5040',
  panelBackground: '#1e1008',
  cardBackground: '#261410',
  cardBorder: '#3a2218',
  glows: {
    activePaneHeader: '0 0 8px 1px rgba(232, 168, 56, 0.18), inset 0 -1px 0 rgba(232, 168, 56, 0.12)',
    sidebarItem: 'inset 2px 0 0 #e8a838, inset 0 0 8px rgba(232, 168, 56, 0.08)',
    titleBarRadial: 'radial-gradient(ellipse 60px 30px at 20px 50%, rgba(232,168,56,0.08) 0%, transparent 100%)',
  },
  gradients: {
    sidebar: 'linear-gradient(180deg, #1e1008 0%, #261410 60%, #2e160a 100%)',
    statusBar: 'linear-gradient(90deg, #0e0906 0%, #130b04 50%, #0e0906 100%)',
  },
  scrollbar: {
    thumb: '#5a3020',
    track: '#1a1008',
  },
  terminal: {
    background: '#1a1008',
    foreground: '#e8dcc8',
    cursor: '#e8a838',
    cursorAccent: '#1a1008',
    selectionBackground: 'rgba(232, 168, 56, 0.25)',
    black: '#1a1008',
    red: '#c05020',
    green: '#70a840',
    yellow: '#e8a838',
    blue: '#4878c0',
    magenta: '#d04020',
    cyan: '#20a8a0',
    white: '#e8dcc8',
    brightBlack: '#5a3828',
    brightRed: '#e06030',
    brightGreen: '#90c858',
    brightYellow: '#f8c048',
    brightBlue: '#6898d8',
    brightMagenta: '#e85030',
    brightCyan: '#30c8b8',
    brightWhite: '#f8f0e0',
  },
};
