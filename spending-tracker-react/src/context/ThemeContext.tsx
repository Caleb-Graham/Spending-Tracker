import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'spending-tracker-theme';

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

const getStoredTheme = (): ThemeMode => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

// ============================================================================
// CENTRALIZED COLOR TOKENS
// ============================================================================
// All app colors defined here - change once, update everywhere
// Based on Material Design dark theme guidelines

// Material Design elevation surfaces (white overlay percentages on #121212)
const elevationSurfaces = {
  light: {
    dp0: '#f5f5f5',   // Base background
    dp1: '#ffffff',   // Cards, dialogs - white
    dp2: '#ffffff',
    dp4: '#fafafa',   // Table headers
    dp8: '#ffffff',   // App bars
    dp24: '#ffffff',  // Highest elevation
  },
  dark: {
    dp0: '#121212',   // Base surface - Material recommended
    dp1: '#1e1e1e',   // 5% white overlay - cards
    dp2: '#222222',   // 7% white overlay
    dp4: '#262626',   // 9% white overlay - table headers
    dp8: '#2e2e2e',   // 12% white overlay - app bars, menus
    dp24: '#383838',  // 16% white overlay - dialogs
  },
};

// Brand/Theme colors
const brandColors = {
  light: {
    primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
    secondary: { main: '#dc004e', light: '#ff4081', dark: '#c51162' },
    error: { main: '#d32f2f', light: '#ef5350', dark: '#c62828' },
    success: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20' },
    warning: { main: '#ed6c02', light: '#ff9800', dark: '#e65100' },
    info: { main: '#0288d1', light: '#03a9f4', dark: '#01579b' },
  },
  dark: {
    // Desaturated 200-tone colors for dark theme (Material Design guideline)
    primary: { main: '#90caf9', light: '#e3f2fd', dark: '#42a5f5' },
    secondary: { main: '#ce93d8', light: '#f3e5f5', dark: '#ab47bc' },
    error: { main: '#cf6679', light: '#f8bbd9', dark: '#b00020' },
    success: { main: '#81c784', light: '#a5d6a7', dark: '#388e3c' },
    warning: { main: '#ffb74d', light: '#ffe0b2', dark: '#f57c00' },
    info: { main: '#64b5f6', light: '#bbdefb', dark: '#1976d2' },
  },
};

// Text colors with proper opacity
const textColors = {
  light: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.60)',
    disabled: 'rgba(0, 0, 0, 0.38)',
    divider: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    primary: 'rgba(255, 255, 255, 0.87)',
    secondary: 'rgba(255, 255, 255, 0.60)',
    disabled: 'rgba(255, 255, 255, 0.38)',
    divider: 'rgba(255, 255, 255, 0.12)',
  },
};

// Action state colors
const actionColors = {
  light: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    active: 'rgba(255, 255, 255, 0.56)',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(255, 255, 255, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.30)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
};

// Semantic colors for specific UI states
const semanticColors = {
  light: {
    // Surfaces
    surfaceDefault: '#ffffff',
    surfaceHover: '#f5f5f5',
    surfaceSelected: '#e3f2fd',
    surfaceHighlight: '#e3f2fd',    // Drag over, active states
    
    // Borders
    borderDefault: '#e0e0e0',
    borderSubtle: 'rgba(0, 0, 0, 0.12)',
    borderActive: '#2196f3',
    
    // Table specific
    tableRowAlt: '#f9f9f9',
    tableRowHover: '#f0f0f0',
    tableHeader: '#fafafa',
    
    // Income/Expense
    incomeText: '#2e7d32',          // Green 800
    expenseText: '#c62828',         // Red 800
    incomeBackground: 'rgba(46, 125, 50, 0.08)',
    
    // Warning/Alert states
    warningBackground: '#fff3e0',
    warningBorder: '#ff9800',
    warningText: '#e65100',
  },
  dark: {
    // Surfaces
    surfaceDefault: '#1e1e1e',
    surfaceHover: 'rgba(255, 255, 255, 0.08)',
    surfaceSelected: 'rgba(255, 255, 255, 0.16)',
    surfaceHighlight: '#1a3a5c',    // Drag over, active states (blue tinted)
    
    // Borders
    borderDefault: 'rgba(255, 255, 255, 0.12)',
    borderSubtle: 'rgba(255, 255, 255, 0.08)',
    borderActive: '#90caf9',
    
    // Table specific
    tableRowAlt: '#262626',
    tableRowHover: 'rgba(255, 255, 255, 0.08)',
    tableHeader: '#262626',
    
    // Income/Expense (desaturated for dark theme)
    incomeText: '#81c784',          // Green 300
    expenseText: '#cf6679',         // Material dark error
    incomeBackground: 'rgba(129, 199, 132, 0.08)',
    
    // Warning/Alert states
    warningBackground: '#3d2a00',
    warningBorder: '#ff9800',
    warningText: '#ffb74d',
  },
};

// Extend MUI's palette type to include our custom colors
declare module '@mui/material/styles' {
  interface Palette {
    elevation: typeof elevationSurfaces.light;
    custom: typeof semanticColors.light;
  }
  interface PaletteOptions {
    elevation?: typeof elevationSurfaces.light;
    custom?: typeof semanticColors.light;
  }
}

const createAppTheme = (mode: ThemeMode): Theme => {
  const isDark = mode === 'dark';
  const surfaces = isDark ? elevationSurfaces.dark : elevationSurfaces.light;
  const semantic = isDark ? semanticColors.dark : semanticColors.light;
  const brand = isDark ? brandColors.dark : brandColors.light;
  const text = isDark ? textColors.dark : textColors.light;
  const action = isDark ? actionColors.dark : actionColors.light;

  return createTheme({
    palette: {
      mode,
      // Add our custom color tokens to the palette
      elevation: surfaces,
      custom: semantic,
      // Use centralized brand colors
      primary: brand.primary,
      secondary: brand.secondary,
      error: brand.error,
      success: brand.success,
      warning: brand.warning,
      info: brand.info,
      // Use centralized background colors
      background: {
        default: surfaces.dp0,
        paper: surfaces.dp1,
      },
      // Use centralized text colors
      text: {
        primary: text.primary,
        secondary: text.secondary,
        disabled: text.disabled,
      },
      divider: text.divider,
      // Use centralized action colors
      action: action,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: ({ theme }: { theme: Theme }) => ({
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            // App bars at 8dp elevation
            backgroundColor: theme.palette.elevation.dp8,
            color: theme.palette.text.primary,
            backgroundImage: 'none',
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            backgroundColor: theme.palette.background.paper,
          }),
          elevation1: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp1,
          }),
          elevation2: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp2,
          }),
          elevation4: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp4,
          }),
          elevation8: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp8,
          }),
          elevation24: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp24,
          }),
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottomColor: theme.palette.divider,
            color: theme.palette.text.primary,
          }),
          head: ({ theme }) => ({
            backgroundColor: theme.palette.custom.tableHeader,
            color: theme.palette.text.primary,
            fontWeight: 600,
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:hover': {
              backgroundColor: theme.palette.custom.tableRowHover,
            },
          }),
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.custom.tableHeader,
            '& .MuiTableCell-head': {
              backgroundColor: theme.palette.custom.tableHeader,
            },
          }),
        },
      },
      MuiTab: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
            '&.Mui-selected': {
              color: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.custom.borderDefault,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: () => ({
            textTransform: 'none',
          }),
          outlined: ({ theme }) => ({
            borderColor: theme.palette.custom.borderDefault,
          }),
          contained: () => ({
            backgroundImage: 'none',
          }),
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: () => ({
            backgroundColor: 'transparent',
          }),
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: () => ({
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'transparent',
            },
          }),
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: ({ theme }) => ({
            borderColor: theme.palette.custom.borderDefault,
          }),
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
          }),
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.primary,
            borderColor: theme.palette.custom.borderDefault,
            '&.Mui-selected': {
              backgroundColor: theme.palette.action.selected,
              color: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp24,
          }),
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.elevation.dp8,
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor: theme.palette.mode === 'dark' ? '#424242' : 'rgba(97, 97, 97, 0.92)',
          }),
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
    },
  });
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => getStoredTheme());

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    // Update document for any non-MUI styles
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const contextValue = useMemo(
    () => ({ mode, toggleTheme, setMode }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
