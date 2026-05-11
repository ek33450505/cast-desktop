export interface ForgeTheme {
  name: string;
  displayName: string;
  background: string;
  foreground: string;
  accent: string;
  accentSoft: string;
  sidebar: string;
  sidebarBorder: string;
  titleBar: string;
  titleBarText: string;
  paneHeader: string;
  paneHeaderActive: string;
  paneHeaderText: string;
  statusBar: string;
  statusBarText: string;
  border: string;
  inputBackground: string;
  inputText: string;
  modalBackground: string;
  modalOverlay: string;
  glows?: {
    activePaneHeader: string;   // box-shadow value
    sidebarItem: string;        // box-shadow value for active sidebar items
    titleBarRadial: string;     // radial-gradient CSS string for title bar overlay
  };
  gradients?: {
    sidebar: string;            // background linear-gradient for sidebar
    statusBar: string;          // background linear-gradient for status bar
  };
  scrollbar?: {
    thumb: string;
    track: string;
  };
  // Phase 8 tokens
  claudeAccent: string;
  claudeAccentBg: string;
  separatorColor: string;
  separatorHover: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  tabBorder: string;
  tabCloseHover: string;
  success: string;
  warning: string;
  error: string;
  textMuted: string;
  textSubtle: string;
  panelBackground: string;
  cardBackground: string;
  cardBorder: string;
  terminal: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent?: string;
    selectionBackground?: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
}
