const lightTheme = {
  colors: {
    primary: "#00C26F",
    primaryDark: "#00AC62",
    dark: "#3E3E3E",
    darkLight: "#E1E1E1",
    gray: "#e3e3e3",
    grayLight: "#f5f5f5",
    white: "#FFFFFF",
    black: "#000000",
    
    // Background colors
    background: "#FFFFFF",
    backgroundSecondary: "#f8f9fa",
    surface: "#FFFFFF",
    
    // Text colors
    text: "#494949",
    textLight: "#7C7C7C",
    textDark: "#1D1D1D",
    textSecondary: "#6c757d",
    
    // Border colors
    border: "#e3e3e3",
    borderLight: "#f1f3f4",
    
    rose: "#ef4444",
    roseLight: "#f87171",
  }
};

const darkTheme = {
  colors: {
    primary: "#00C26F",
    primaryDark: "#00AC62",
    dark: "#3E3E3E",
    darkLight: "#4a4a4a",
    gray: "#404040",
    grayLight: "#2a2a2a",
    white: "#1a1a1a",
    black: "#FFFFFF",
    
    // Background colors
    background: "#121212",
    backgroundSecondary: "#1e1e1e",
    surface: "#2a2a2a",
    
    // Text colors
    text: "#e0e0e0",
    textLight: "#a0a0a0",
    textDark: "#ffffff",
    textSecondary: "#b0b0b0",
    
    // Border colors
    border: "#404040",
    borderLight: "#353535",
    
    rose: "#ef4444",
    roseLight: "#f87171",
  }
};

export const getTheme = (isDarkMode = false) => {
  return {
    colors: isDarkMode ? darkTheme.colors : lightTheme.colors,
    fonts: {
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
    radius: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 22,
    },
  };
};

// Default theme for backward compatibility
export const theme = getTheme(false);
