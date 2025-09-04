import { useRouter } from "expo-router";
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Call from "../../assets/icons/Call";
import Edit from "../../assets/icons/Edit";
import Logout from "../../assets/icons/logout";
import Mail from "../../assets/icons/Mail";
import Settings from "../../assets/icons/Settings";
import Avatar from "../../components/Avatar";
import FooterNav from '../../components/FooterNav';
import Header from "../../components/Header";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getTheme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useFollow } from "../../contexts/FollowContext";
import { useTheme } from "../../contexts/ThemeContext";
import { hp, wp } from "../../helpers/common";
import { supabase } from "../../lib/supabase";
import { getFollowerCount, getFollowingCount, assignUsernameToUser } from "../../services/userServices";

import { useCallback, useEffect, useState } from "react";
import UserPosts from "../../components/UserPosts";

// Cross-platform alert function
const showAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      // For confirm dialogs on web
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!confirmed && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      // For simple alerts on web
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    // Use native Alert for mobile
    Alert.alert(title, message, buttons);
  }
};

const Profile = () => {
  const { user, setAuth } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // Get current theme
  const theme = getTheme(isDarkMode);

  const onLogout = async () => {
    try {
      console.log("Starting logout process...");

      // First clear local state
      setAuth(null);
      console.log("Local auth state cleared");

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Supabase logout error:", error.message, error.status);
        // Even if there's an error, we've cleared local state, so navigate anyway
        showAlert("Sign Out", `Logged out locally. Error: ${error.message}`);
      } else {
        console.log("Supabase logout successful");
      }

      // Navigate to welcome screen
      console.log("Navigating to welcome screen...");
      router.replace("/welcome");
    } catch (error) {
      console.error("Logout exception:", error);
      // Clear local state and navigate even if there's an exception
      setAuth(null);
      router.replace("/welcome");
      showAlert(
        "Sign Out",
        `Logged out locally. Exception: ${error.message}`
      );
    }
  };

  const handleLogout = () => {
    console.log("Logout button pressed"); // Debug log
    showAlert("Confirm", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        onPress: () => console.log("Logout cancelled"),
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: () => onLogout(),
        style: "destructive",
      },
    ]);
  };
  // Get dynamic styles based on current theme
  const styles = getStyles(theme);

  return (
    <ScreenWrapper bg={theme.colors.background} style={{ flex: 1, minHeight: 0 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={true}>
        <UserHeader user={user} router={router} handleLogout={handleLogout} />
      </ScrollView>
      <FooterNav />
    </ScreenWrapper>
  );
};


const UserHeader = ({ user, router, handleLogout }) => {
  const { user: currentUser, setUserData } = useAuth();
  const { isDarkMode } = useTheme();
  const { 
    addFollowListener, 
    getFollowData, 
    initializeFollowData, 
    refreshFollowStatus, 
    refreshFollowCounts,
    isInitialized 
  } = useFollow();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);
  
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Set up real-time subscription for posts
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `userid=eq.${user.id}`
        },
        (payload) => {
          console.log('Post change detected for user:', payload);
          // Refresh post count when posts change
          fetchPostCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Listen for real-time follow updates for the current user
  useEffect(() => {
    if (!user?.id || !isInitialized) return;
    
    const cleanup = addFollowListener(async (event) => {
      console.log('Follow event received in profile:', event);
      
      if (event.targetUserId === user.id || event.currentUserId === user.id) {
        // Refresh counts using the context method for accuracy
        const counts = await refreshFollowCounts(user.id);
        if (counts) {
          setFollowerCount(counts.followerCount);
          setFollowingCount(counts.followingCount);
          console.log('Refreshed follow counts from real-time event:', counts);
        }
      }
    });

    return cleanup;
  }, [user?.id, isInitialized]);

  // Function to fetch post count
  const fetchPostCount = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { fetchPost } = require("../../services/postService");
      const { success, data } = await fetchPost(1000);
      if (success) {
        const userPosts = data.filter(post => {
          const postUserId = typeof post.userid === 'object' ? post.userid?.toString() : String(post.userid);
          const currentUserId = typeof user.id === 'object' ? user.id?.toString() : String(user.id);
          return postUserId === currentUserId;
        });
        setPostCount(userPosts.length);
      }
    } catch (error) {
      console.error('Error fetching post count:', error);
    }
  }, [user?.id]);

  // Fetch all counts and initialize data
  useEffect(() => {
    async function fetchCounts() {
      if (!user?.id || !isInitialized) return;
      
      setIsLoading(true);
      
      try {
        console.log(`🔍 Fetching counts for user ${user.id} (${user.username ? `@${user.username}` : user.name})`);
        
        // Check if user needs username assignment
        if (user?.name && (!user?.username || user.username.trim() === '')) {
          console.log('👤 User missing username, attempting to assign one...');
          const usernameResult = await assignUsernameToUser(user.id, user.name);
          if (usernameResult.success && usernameResult.username) {
            console.log(`✅ Assigned username: ${usernameResult.username}`);
            // Update the user object in auth context if this is the current user
            if (currentUser && currentUser.id === user.id) {
              setUserData({ username: usernameResult.username });
              console.log('✅ Updated user data with new username');
            }
          } else {
            console.log('❌ Failed to assign username:', usernameResult.msg);
          }
        }
        
        // Use the enhanced refreshFollowCounts method
        const counts = await refreshFollowCounts(user.id);
        
        if (counts) {
          console.log(`✅ Got counts from context:`, counts);
          setFollowerCount(counts.followerCount);
          setFollowingCount(counts.followingCount);
          console.log(`📊 Updated local state - Followers: ${counts.followerCount}, Following: ${counts.followingCount}`);
        } else {
          // Fallback to individual API calls if context method fails
          console.log('⚠️ Context method failed, falling back to individual API calls...');
          
          const [followerRes, followingRes] = await Promise.all([
            getFollowerCount(user.id),
            getFollowingCount(user.id)
          ]);
          
          console.log('🔄 API Results:', { followerRes, followingRes });
          
          const newFollowerCount = followerRes.success ? followerRes.count : 0;
          const newFollowingCount = followingRes.success ? followingRes.count : 0;
          
          setFollowerCount(newFollowerCount);
          setFollowingCount(newFollowingCount);
          
          console.log(`📊 Updated from API - Followers: ${newFollowerCount}, Following: ${newFollowingCount}`);
        }

        // Fetch post count
        await fetchPostCount();
        
      } catch (error) {
        console.error('❌ Error fetching counts:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchCounts();
  }, [user?.id, isInitialized, fetchPostCount]);

  // Refresh data when component becomes visible again
  useEffect(() => {
    const unsubscribe = router.addListener?.('focus', async () => {
      console.log('Profile focused, refreshing data...');
      if (user?.id && isInitialized) {
        // Refresh follow counts
        const counts = await refreshFollowCounts(user.id);
        if (counts) {
          setFollowerCount(counts.followerCount);
          setFollowingCount(counts.followingCount);
        }
        
        // Refresh follow status
        refreshFollowStatus(user.id);
        
        // Refresh post count
        fetchPostCount();
      }
    });

    return unsubscribe;
  }, [user?.id, isInitialized, fetchPostCount]);

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1, paddingHorizontal: wp(4), paddingBottom: 30 }}>
      <View>
        <Header title="Profile" showBackButton={false} mb={30} />
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push("/main/settings")}>
            <Settings size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Logout size={20} color={theme.colors.rose} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.container}>
        <View style={{ gap: 15 }}>
          <View style={styles.avatarContainer}>
            <Avatar
              uri={user?.image}
              size={hp(12)}
              rounded={theme.radius.xxl * 1.4}
            />
            <Pressable
              style={styles.editIcon}
              onPress={() => router.push("/main/editProfile")}
            >
              <Edit strokeWidth={2.5} size={20} />
            </Pressable>
          </View>
          {/* username and address */}
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={styles.userName}>
              {user && user.username ? `@${user.username}` : (user && user.name)}
            </Text>
            {user && user.username && user.name && (
              <Text style={styles.usernameText}>{user.name}</Text>
            )}
            <Text style={styles.infoText}>{user && user.address}</Text>
          </View>

          {/* Counts Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 16 }}>
            <TouchableOpacity style={{ alignItems: 'center', marginHorizontal: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                {isLoading ? '...' : postCount}
              </Text>
              <Text style={{ color: theme.colors.textLight }}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ alignItems: 'center', marginHorizontal: 16 }}
              onPress={() => router.push(`/main/followList?userId=${user?.id}&type=followers&userName=${user?.username ? user.username : user?.name}`)}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                {isLoading ? '...' : followerCount}
              </Text>
              <Text style={{ color: theme.colors.textLight }}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ alignItems: 'center', marginHorizontal: 16 }}
              onPress={() => router.push(`/main/followList?userId=${user?.id}&type=following&userName=${user?.username ? user.username : user?.name}`)}
            >
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                {isLoading ? '...' : followingCount}
              </Text>
              <Text style={{ color: theme.colors.textLight }}>Following</Text>
            </TouchableOpacity>
          </View>

          {/* email,phone,bio */}
          <View style={styles.info}>
            <Mail size={20} color={theme.colors.textLight} />
            <Text style={styles.infoText}>{user && user.email}</Text>
          </View>
          {user && user.phoneNumber && (
            <View style={styles.info}>
              <Call size={20} color={theme.colors.textLight} />
              <Text style={styles.infoText}>{user && user.phoneNumber}</Text>
            </View>
          )}
          {user && user.bio && (
            <View style={styles.infoText}>
              <Text style={styles.infoText}>{user.bio}</Text>
            </View>
          )}
        </View>
      </View>

      {/* User's Posts */}
      <Text style={{fontWeight:'bold',fontSize:18,marginTop:30,marginBottom:10}}>My Posts</Text>
      <View style={{ minHeight: 200 }}>
        {/* Show all posts by this user */}
        <UserPosts userId={user?.id} currentUser={user} router={router} />
      </View>
    </View>
  );
};

export default Profile;

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    marginHorizontal: wp(4),
    marginBottom: 20,
  },
  headerShape: {
    width: wp(100),
    height: hp(20),
  },
  avatarContainer: {
    height: hp(12),
    width: hp(12),
    alignSelf: "center",
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: -12,
    padding: 7,
    borderRadius: 50,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.textLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 7,
  },
  userName: {
    fontSize: hp(3),
    fontWeight: "500",
    color: theme.colors.textDark,
  },
  usernameText: {
    fontSize: hp(1.8),
    fontWeight: "400",
    color: theme.colors.textLight,
    marginTop: -2,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    fontSize: hp(1.6),
    fontWeight: "500",
    color: theme.colors.textLight,
  },

  headerButtons: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    gap: 10,
  },

  settingsButton: {
    padding: 5,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.darkLight,
  },

  logoutButton: {
    padding: 5,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
  },

  listStyle: {
    paddingHorizontal: wp(4),
    paddingBottom: 30,
  },

  noPosts: {
    fontSize: hp(2),
    textAlign: "center",
    color: theme.colors.text,
  },
});
