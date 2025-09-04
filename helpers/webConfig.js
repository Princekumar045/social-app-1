// Web-specific configuration and utilities
import { Dimensions, Platform } from 'react-native';

export const configureWebStyles = () => {
  if (Platform.OS !== 'web') return;
  
  // Add global CSS for web centering
  const style = document.createElement('style');
  style.id = 'social-app-web-styles';
  
  // Avoid duplicate styles
  if (document.getElementById('social-app-web-styles')) {
    document.getElementById('social-app-web-styles').remove();
  }
  
  style.textContent = `
    /* Global reset and centering */
    * {
      box-sizing: border-box;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    body {
      background-color: #f8f9fa;
      overflow-x: hidden;
    }
    
    /* Mobile styles (default) */
    #root {
      width: 100%;
      min-height: 100vh;
      background-color: white;
    }
    
    /* Tablet and desktop styles */
    @media (min-width: 768px) {
      body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 20px;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }
      
      #root {
        max-width: 480px;
        width: 100%;
        background-color: white;
        border-radius: 20px;
        box-shadow: 
          0 10px 40px rgba(0, 0, 0, 0.1),
          0 2px 10px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        min-height: calc(100vh - 40px);
        position: relative;
      }
      
      /* Add subtle animation */
      #root {
        transition: all 0.3s ease;
      }
      
      #root:hover {
        transform: translateY(-2px);
        box-shadow: 
          0 15px 50px rgba(0, 0, 0, 0.15),
          0 5px 15px rgba(0, 0, 0, 0.08);
      }
    }
    
    /* Large desktop styles */
    @media (min-width: 1200px) {
      #root {
        max-width: 520px;
      }
    }
    
    /* Handle scrollbars */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
    
    /* Smooth focus transitions */
    input, button, textarea {
      transition: all 0.2s ease;
    }
    
    /* Ensure proper image scaling */
    img {
      max-width: 100%;
      height: auto;
    }
  `;
  
  document.head.appendChild(style);
  
  // Add viewport meta tag if not present
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
  }
};

// Get responsive container styles
export const getWebContainerStyles = () => {
  if (Platform.OS !== 'web') return {};
  
  const { width } = Dimensions.get('window');
  
  return {
    maxWidth: width > 768 ? 480 : '100%',
    alignSelf: 'center',
    backgroundColor: 'white',
    ...(width > 768 && {
      borderRadius: 20,
      overflow: 'hidden',
    }),
  };
};
