import { Dimensions, Platform } from 'react-native';

/**
 * Utility functions for responsive web design in React Native
 */

// Check if running on web
export const isWeb = Platform.OS === 'web';

// Get current screen dimensions
export const getScreenSize = () => Dimensions.get('window');

// Responsive breakpoints
export const breakpoints = {
  xs: 320,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1200,
};

// Get responsive padding based on screen size
export const getResponsivePadding = () => {
  if (!isWeb) return 0;
  
  const { width } = getScreenSize();
  
  if (width >= breakpoints.xl) return 40;
  if (width >= breakpoints.lg) return 32;
  if (width >= breakpoints.md) return 24;
  if (width >= breakpoints.sm) return 16;
  return 12;
};

// Get responsive margin
export const getResponsiveMargin = () => {
  if (!isWeb) return 0;
  
  const { width } = getScreenSize();
  
  if (width >= breakpoints.lg) return 20;
  if (width >= breakpoints.md) return 16;
  return 0;
};

// Check if screen is mobile size
export const isMobileScreen = () => {
  const { width } = getScreenSize();
  return width < breakpoints.md;
};

// Check if screen is tablet size
export const isTabletScreen = () => {
  const { width } = getScreenSize();
  return width >= breakpoints.md && width < breakpoints.lg;
};

// Check if screen is desktop size
export const isDesktopScreen = () => {
  const { width } = getScreenSize();
  return width >= breakpoints.lg;
};

// Get container max width for centering
export const getMaxContainerWidth = () => {
  if (!isWeb) return '100%';
  
  const { width } = getScreenSize();
  
  if (width >= breakpoints.xl) return 520;
  if (width >= breakpoints.lg) return 480;
  if (width >= breakpoints.md) return 400;
  return '100%';
};

// Web-only styles helper
export const webOnly = (styles) => {
  return isWeb ? styles : {};
};

// Mobile-only styles helper
export const mobileOnly = (styles) => {
  return !isWeb ? styles : {};
};
