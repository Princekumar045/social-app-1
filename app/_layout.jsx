import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { FollowProvider } from '../contexts/FollowContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { configureWebStyles } from '../helpers/webConfig';
import { supabase } from '../lib/supabase';
import { getUserData } from '../services/userServices';


LogBox.ignoreLogs(['Warning : TNodeChildrenRenderer','Warning: TNodeChildrenRenderer', 'Warning: TNodeChildrenRenderer', 'Warning: TNodeChildrenRenderer']);

const _layout = () => {
  useEffect(() => {
    // Configure web-specific styles
    configureWebStyles();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FollowProvider>
            <View style={styles.webContainer}>
              <MainLayout />
            </View>
          </FollowProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const MainLayout = () => {
  const {setAuth, setUserData} = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setAuth(session?.user);
          await updateUserData(session?.user);
          // Don't navigate immediately, let the component render first
          setTimeout(() => router.replace('/main/home'), 100);
        } else {
          setAuth(null);
          setTimeout(() => router.replace('/welcome'), 100);
        }
        setIsReady(true);
      } catch (error) {
        console.error('Auth check error:', error);
        setAuth(null);
        setTimeout(() => router.replace('/welcome'), 100);
        setIsReady(true);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      console.log('Current user:', session?.user);
      
      if (session) {
        setAuth(session?.user);
        await updateUserData(session?.user, session?.user?.email);
        router.replace('/main/home');
      } else {
        setAuth(null);
        router.replace('/welcome');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [])

  const updateUserData = async (user, email) => {
    try {
      let res = await getUserData(user?.id);
      if (res.success) setUserData({ ...res.data, email });
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  )
}

export default _layout

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      width: '100%',
      maxWidth: '100%',
    }),
  },
})