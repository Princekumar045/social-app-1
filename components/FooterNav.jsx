import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import HomeIcon from '../assets/icons/Home';
import PlusIcon from '../assets/icons/Plus';
import SearchIcon from '../assets/icons/Search';
import VideoIcon from '../assets/icons/Video';
import { getTheme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Avatar from './Avatar';

const FooterNav = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);

  // Get current route to highlight active tab
  const getCurrentRoute = () => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.pathname;
    }
    return '';
  };
  
  const currentRoute = getCurrentRoute();

  return (
    <View style={styles.container}>
      <Pressable 
        onPress={() => router.push('/main/home')} 
        style={[
          styles.iconBtn,
          currentRoute.includes('/main/home') && styles.activeTab
        ]}
      >
        <HomeIcon 
          size={28} 
          color={currentRoute.includes('/main/home') ? theme.colors.primary : theme.colors.text} 
        />
      </Pressable>
      
      <Pressable 
        onPress={() => router.push('/main/search')} 
        style={[
          styles.iconBtn,
          currentRoute.includes('/main/search') && styles.activeTab
        ]}
      >
        <SearchIcon 
          size={28} 
          color={currentRoute.includes('/main/search') ? theme.colors.primary : theme.colors.text} 
        />
      </Pressable>
      
      <Pressable onPress={() => router.push('/main/newPost')} style={styles.iconBtn}>
        <PlusIcon size={28} color={theme.colors.text} />
      </Pressable>
      
      <Pressable 
        onPress={() => router.push('/main/videoPosts')} 
        style={[
          styles.iconBtn,
          currentRoute.includes('/main/videoPosts') && styles.activeTab
        ]}
      >
        <VideoIcon 
          size={28} 
          color={currentRoute.includes('/main/videoPosts') ? theme.colors.primary : theme.colors.text} 
        />
      </Pressable>
      
      <Pressable 
        onPress={() => router.push('/main/profile')} 
        style={[
          styles.iconBtn,
          currentRoute.includes('/main/profile') && styles.activeTab
        ]}
      >
        <Avatar 
          uri={user?.image} 
          size={32} 
          rounded={theme.radius.sm} 
          style={{ 
            borderWidth: 2, 
            borderColor: currentRoute.includes('/main/profile') ? theme.colors.primary : theme.colors.gray 
          }} 
        />
      </Pressable>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 60,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...Platform.select({
      web: {
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        maxWidth: 1200,
        marginHorizontal: 'auto',
        width: '100%',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }),
  },
  iconBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  activeTab: {
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        transform: 'scale(1.1)',
      },
      default: {
        backgroundColor: 'rgba(0,0,0,0.05)',
      },
    }),
    borderRadius: 8,
  },
});

export default FooterNav;
