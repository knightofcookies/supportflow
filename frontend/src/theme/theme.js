// src/theme/theme.js
import { createTheme } from "@mui/material/styles";

// Function to check the user's preferred color scheme
const getPrefersDarkMode = () => {
  // Ensure window and matchMedia are available (for environments like SSR)
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false; // Default to light mode if not in a browser or matchMedia is not supported
};

const prefersDarkMode = getPrefersDarkMode();

// Define your light and dark palettes
const lightPalette = {
  primary: { main: "#673ab7" }, // Example: Deep Purple
  secondary: { main: "#ff4081" }, // Example: Pink
  background: {
    default: "#f4f6f8", // Light grey background
    paper: "#ffffff",
  },
  text: {
    primary: "rgba(0, 0, 0, 0.87)",
    secondary: "rgba(0, 0, 0, 0.6)",
    disabled: "rgba(0, 0, 0, 0.38)",
  },
  success: { main: "#4CAF50" },
  error: { main: "#F44336" },
  info: { main: "#2196F3" },
  warning: { main: "#FF9800" },
};

const darkPalette = {
  primary: { main: "#90caf9" }, // Lighter purple for dark mode
  secondary: { main: "#f48fb1" }, // Lighter pink for dark mode
  background: {
    default: "#121212", // Dark background
    paper: "#1e1e1e",   // Slightly lighter dark for paper elements
  },
  text: {
    primary: "#ffffff",
    secondary: "rgba(255, 255, 255, 0.7)",
    disabled: "rgba(255, 255, 255, 0.5)",
  },
  success: { main: "#66bb6a" }, // Adjusted for dark mode
  error: { main: "#ef5350" },   // Adjusted for dark mode
  info: { main: "#42a5f5" },    // Adjusted for dark mode
  warning: { main: "#ffa726" }, // Adjusted for dark mode
};

// Determine current mode and palette
const currentMode = prefersDarkMode ? 'dark' : 'light';
const currentPalette = prefersDarkMode ? darkPalette : lightPalette;

// Create the theme
const theme = createTheme({
  palette: {
    mode: currentMode, // Essential for MUI to know if it's dark or light mode
    ...currentPalette, // Spread the chosen palette
  },
  typography: {
    fontFamily: "Roboto, Helvetica, Arial, sans-serif",
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          transition: "box-shadow 0.3s ease-in-out",
          // Card background will default to palette.background.paper
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: "8px" },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: "none",
          // Text and background colors will be inherited from the theme's text and background settings.
          // However, for more specific control in dark/light mode for complex components:
          color: currentPalette.text.primary,
          backgroundColor: currentPalette.background.paper,
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: prefersDarkMode ? "#333333" : "#f5f5f5",
            borderBottom: `1px solid ${prefersDarkMode ? "#424242" : "#e0e0e0"}`,
            color: currentPalette.text.secondary,
          },
          "& .MuiDataGrid-cell": {
            borderBottom: `1px solid ${prefersDarkMode ? "#424242" : "#e0e0e0"}`,
          },
          "& .MuiDataGrid-overlay": {
            height: "auto !important",
            backgroundColor: prefersDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)', // Adjusted for visibility
          },
          "& .MuiDataGrid-virtualScroller": { minHeight: "100px" },
          "& .MuiTablePagination-root": {
            color: currentPalette.text.secondary,
          },
          "& .MuiIconButton-root": {
            color: currentPalette.text.secondary, // Ensure icons in pagination are visible
          },
          "& .MuiDataGrid-toolbarContainer": { // Example for toolbar buttons if you have one
             "& .MuiButton-root": {
                 color: currentPalette.text.primary,
             }
          }
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: {
          // Invert tooltip for better contrast
          backgroundColor: prefersDarkMode ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.87)',
          color: prefersDarkMode ? 'rgba(0, 0, 0, 0.87)' : 'rgba(255, 255, 255, 0.92)',
        },
        arrow: {
          color: prefersDarkMode ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.87)',
        }
      }
    },
    // You might need to adjust other components if they have hardcoded colors
    // that don't adapt well to the dark/light theme.
  },
});

export default theme;