import { Dimensions, Platform } from 'react-native';

// Get screen dimensions
export const getScreenDimensions = () => {
  return Dimensions.get('window');
};

// Check if we're on web
export const isWeb = Platform.OS === 'web';

// Responsive breakpoints
export const breakpoints = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  large: 1200,
};

// Get current screen type
export const getScreenType = () => {
  const { width } = getScreenDimensions();
  
  if (width >= breakpoints.large) return 'large';
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
};

// Get container max width based on screen size
export const getContainerMaxWidth = () => {
  const screenType = getScreenType();
  const { width } = getScreenDimensions();
  
  switch (screenType) {
    case 'large':
      return Math.min(800, width * 0.4);
    case 'desktop':
      return Math.min(700, width * 0.5);
    case 'tablet':
      return Math.min(600, width * 0.7);
    default:
      return width;
  }
};

// Get responsive padding
export const getResponsivePadding = () => {
  const screenType = getScreenType();
  
  switch (screenType) {
    case 'large':
    case 'desktop':
      return { paddingHorizontal: 40 };
    case 'tablet':
      return { paddingHorizontal: 30 };
    default:
      return { paddingHorizontal: 20 };
  }
};
