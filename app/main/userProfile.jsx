import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Call from "../../assets/icons/Call";
import Mail from "../../assets/icons/Mail";
import MessageCircle from "../../assets/icons/Message";
import Avatar from "../../components/Avatar";
import FooterNav from '../../components/FooterNav';
import Header from "../../components/Header";
import ScreenWrapper from "../../components/ScreenWrapper";
import UserPosts from "../../components/UserPosts";
import { getTheme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useFollow } from "../../contexts/FollowContext";
import { useTheme } from "../../contexts/ThemeContext";
import { hp, wp } from "../../helpers/common";
import { getOrCreateConversation } from "../../services/messageService";
import { followUser, getFollowerCount, getFollowingCount, getUserData, isFollowing, unfollowUser } from "../../services/userServices";

// Cross-platform alert function
const showAlert = (title, message, buttons = []) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!confirmed && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

const UserProfile = () => {
  const { id } = useLocalSearchParams(); // User ID from route params
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isUserFollowing, setIsUserFollowing] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  const { 
    addFollowListener, 
    getFollowData, 
    refreshFollowCounts 
  } = useFollow();

  // Get current theme
  const theme = getTheme(isDarkMode);

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      console.log('Fetching profile for user ID:', id);
      
      // Try getUserProfile first (more complete data)
      const { getUserProfile } = require("../../services/messageService");
      let result = await getUserProfile(id);
      
      // If getUserProfile fails, fallback to getUserData
      if (!result.success) {
        console.log('getUserProfile failed, trying getUserData...');
        result = await getUserData(id);
      }
      
      if (result.success && result.data) {
        console.log('User profile data fetched:', result.data);
        console.log('User profile keys:', Object.keys(result.data));
        console.log('Email:', result.data.email);
        console.log('Phone:', result.data.phoneNumber);
        console.log('Bio:', result.data.bio);
        setUserProfile(result.data);
        
        // Fetch follow counts
        const followerResult = await getFollowerCount(id);
        const followingResult = await getFollowingCount(id);
        
        console.log('Follower result:', followerResult);
        console.log('Following result:', followingResult);
        
        if (followerResult.success) {
          console.log('Follower count:', followerResult.count);
          setFollowerCount(followerResult.count || 0);
        } else {
          console.log('Follower count failed:', followerResult.msg);
          setFollowerCount(0);
        }
        
        if (followingResult.success) {
          console.log('Following count:', followingResult.count);
          setFollowingCount(followingResult.count || 0);
        } else {
          console.log('Following count failed:', followingResult.msg);  
          setFollowingCount(0);
        }
        
        // Check if current user is following this user
        if (currentUser?.id && currentUser.id !== id) {
          const followingResult = await isFollowing(currentUser.id, id);
          if (followingResult.success) {
            setIsUserFollowing(followingResult.following); // Use .following not .data
          }
        }
      } else {
        console.error('Failed to fetch user profile:', result.msg);
        // Still try to show partial data
        setUserProfile({
          id: id,
          name: 'Unknown User',
          email: '',
          image: null,
          bio: '',
          phoneNumber: '',
          address: ''
        });
        setFollowerCount(0);
        setFollowingCount(0);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile({
        id: id,
        name: 'Error Loading User', 
        email: '',
        image: null,
        bio: '',
        phoneNumber: '',
        address: ''
      });
      setFollowerCount(0);
      setFollowingCount(0);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser?.id]);

  // Function to fetch post count
  const fetchPostCount = useCallback(async () => {
    if (!id) return;
    
    try {
      const { fetchPost } = require("../../services/postService");
      const result = await fetchPost();
      if (result.success) {
        const userPosts = result.data.filter(post => post.userid === id);
        setPostCount(userPosts.length);
      }
    } catch (error) {
      console.error('Error fetching post count:', error);
    }
  }, [id]);

  useEffect(() => {
    fetchUserProfile();
    fetchPostCount();
  }, [id, currentUser?.id]); // Remove function dependencies to prevent infinite loop

  // Real-time follow updates
  useEffect(() => {
    if (!id || !currentUser?.id) return;
    
    const cleanup = addFollowListener(async (event) => {
      console.log('Follow event received in user profile:', event);
      
      if (event.targetUserId === id || event.currentUserId === currentUser.id) {
        // Refresh counts
        const counts = await refreshFollowCounts(id);
        if (counts) {
          setFollowerCount(counts.followerCount);
          setFollowingCount(counts.followingCount);
        }
        
        // Refresh follow status if this affects current relationship
        if (event.targetUserId === id && event.currentUserId === currentUser.id) {
          setIsUserFollowing(event.isFollowing);
        }
      }
    });

    return cleanup;
  }, [id, currentUser?.id]); // Remove function dependencies

  const handleFollow = async () => {
    if (!currentUser?.id || !userProfile?.id || followLoading) return;
    
    setFollowLoading(true);
    try {
      let result;
      if (isUserFollowing) {
        result = await unfollowUser(currentUser.id, userProfile.id);
      } else {
        result = await followUser(currentUser.id, userProfile.id);
      }
      
      if (result.success) {
        setIsUserFollowing(!isUserFollowing);
        // Update follower count immediately
        setFollowerCount(prev => isUserFollowing ? prev - 1 : prev + 1);
      } else {
        showAlert('Error', result.msg || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showAlert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!userProfile?.id || !currentUser?.id) {
      showAlert('Error', 'Unable to start conversation. Please try again.');
      return;
    }
    
    try {
      console.log('Creating conversation with user:', userProfile.username ? `@${userProfile.username}` : userProfile.name, userProfile.id);
      const response = await getOrCreateConversation(currentUser.id, userProfile.id);
      
      if (response.success) {
        router.push({
          pathname: '/main/chat',
          params: {
            conversationId: response.data,
            otherUserId: userProfile.id,
            otherUserName: userProfile.username ? `@${userProfile.username}` : userProfile.name,
            otherUserImage: userProfile.image
          }
        });
      } else {
        console.log('Failed to create conversation:', response.msg);
        const errorMsg = response.msg || 'Unknown error occurred';
        
        if (errorMsg.includes('Database tables not set up')) {
          showAlert('Database Setup Required', 'Please run the SQL setup script in your Supabase dashboard. Check the MESSAGING_TROUBLESHOOTING.md file for instructions.');
        } else if (errorMsg.includes('relation "conversations" does not exist')) {
          showAlert('Database Tables Missing', 'The messaging tables have not been created. Please run database/messages_setup_simple.sql in your Supabase SQL editor.');
        } else {
          showAlert('Error', `Failed to start conversation: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Error in handleMessage:', error);
      showAlert('Error', 'Failed to start conversation. Please try again.');
    }
  };

  // Get dynamic styles based on current theme
  const styles = getStyles(theme);

  if (loading) {
    return (
      <ScreenWrapper bg={theme.colors.background}>
        <Header title="Profile" showBackButton={true} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: theme.colors.textLight }}>Loading...</Text>
        </View>
        <FooterNav />
      </ScreenWrapper>
    );
  }

  if (!userProfile) {
    return (
      <ScreenWrapper bg={theme.colors.background}>
        <Header title="Profile" showBackButton={true} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: theme.colors.textLight }}>User not found</Text>
        </View>
        <FooterNav />
      </ScreenWrapper>
    );
  }

  const isOwnProfile = currentUser?.id === userProfile.id;

  return (
    <ScreenWrapper bg={theme.colors.background} style={{ flex: 1, minHeight: 0 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={true}>
        <Header title={userProfile.username ? `@${userProfile.username}` : userProfile.name} showBackButton={true} />
        
        <View style={{ backgroundColor: theme.colors.background, flex: 1, paddingHorizontal: wp(4), paddingBottom: 30 }}>
          <View style={styles.container}>
            <View style={{ gap: 15 }}>
              <View style={styles.avatarContainer}>
                <Avatar
                  uri={userProfile?.image}
                  size={hp(12)}
                  rounded={theme.radius.xxl * 1.4}
                />
              </View>
              
              {/* username and address */}
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={styles.userName}>
                  {userProfile.username ? `@${userProfile.username}` : (userProfile.name || 'Unknown User')}
                </Text>
                {userProfile.username && userProfile.name && (
                  <Text style={styles.usernameText}>{userProfile.name}</Text>
                )}
                {userProfile.address && (
                  <Text style={styles.infoText}>{userProfile.address}</Text>
                )}
              </View>

              {/* Follow/Message buttons for other users */}
              {!isOwnProfile && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      {
                        backgroundColor: isUserFollowing ? theme.colors.gray : theme.colors.primary,
                      }
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    <Text style={[styles.followButtonText, {
                      color: isUserFollowing ? theme.colors.textDark : 'white'
                    }]}>
                      {followLoading ? 'Loading...' : (isUserFollowing ? 'Unfollow' : 'Follow')}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.messageButton, { backgroundColor: theme.colors.backgroundSecondary }]}
                    onPress={handleMessage}
                  >
                    <MessageCircle size={20} color={theme.colors.primary} />
                    <Text style={[styles.messageButtonText, { color: theme.colors.primary }]}>
                      Message
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Counts Row */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 16 }}>
                <TouchableOpacity style={{ alignItems: 'center', marginHorizontal: 16 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                    {postCount}
                  </Text>
                  <Text style={{ color: theme.colors.textLight }}>Posts</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ alignItems: 'center', marginHorizontal: 16 }}
                  onPress={() => router.push(`/main/followList?userId=${userProfile.id}&type=followers&userName=${userProfile.username ? userProfile.username : userProfile.name}`)}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                    {followerCount}
                  </Text>
                  <Text style={{ color: theme.colors.textLight }}>Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ alignItems: 'center', marginHorizontal: 16 }}
                  onPress={() => router.push(`/main/followList?userId=${userProfile.id}&type=following&userName=${userProfile.username ? userProfile.username : userProfile.name}`)}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textDark }}>
                    {followingCount}
                  </Text>
                  <Text style={{ color: theme.colors.textLight }}>Following</Text>
                </TouchableOpacity>
              </View>

              {/* email, phone, bio - Show sensitive info only to profile owner */}
              {/* Privacy notice for own profile */}
              {isOwnProfile && (userProfile.email || userProfile.phoneNumber) && (
                <View style={styles.privacyNotice}>
                  <Text style={[styles.privacyText, { color: theme.colors.textLight }]}>
                    🔒 Your email and phone number are private and only visible to you
                  </Text>
                </View>
              )}
              
              {/* Email - Only show to profile owner */}
              {isOwnProfile && userProfile.email && (
                <View style={styles.info}>
                  <Mail size={20} color={theme.colors.textLight} />
                  <Text style={styles.infoText}>{userProfile.email}</Text>
                </View>
              )}
              
              {/* Phone - Only show to profile owner */}
              {isOwnProfile && userProfile.phoneNumber && (
                <View style={styles.info}>
                  <Call size={20} color={theme.colors.textLight} />
                  <Text style={styles.infoText}>{userProfile.phoneNumber}</Text>
                </View>
              )}
              
              {/* Bio - Show to everyone with public indicator */}
              {userProfile.bio && (
                <View style={styles.bioContainer}>
                  <Text style={[styles.bioLabel, { color: theme.colors.textLight }]}>
                    About {isOwnProfile ? 'Me' : (userProfile.username ? `@${userProfile.username}` : userProfile.name)}
                  </Text>
                  <Text style={styles.infoText}>{userProfile.bio}</Text>
                </View>
              )}
              
              {/* Show a message if no public info is available for other users */}
              {!isOwnProfile && !userProfile.bio && (
                <View style={styles.noInfoContainer}>
                  <Text style={[styles.infoText, { fontStyle: 'italic', textAlign: 'center' }]}>
                    No public information available
                  </Text>
                </View>
              )}
              
              {/* Show a message if no additional info is available for own profile */}
              {isOwnProfile && !userProfile.email && !userProfile.phoneNumber && !userProfile.bio && (
                <View style={styles.noInfoContainer}>
                  <Text style={[styles.infoText, { fontStyle: 'italic', textAlign: 'center' }]}>
                    No additional information available
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* User's Posts */}
          <Text style={{fontWeight:'bold',fontSize:18,marginTop:30,marginBottom:10, color: theme.colors.textDark}}>
            {isOwnProfile ? 'My Posts' : `${userProfile.username ? `@${userProfile.username}` : userProfile.name}'s Posts`}
          </Text>
          <View style={{ minHeight: 200 }}>
            <UserPosts userId={userProfile.id} currentUser={currentUser} router={router} />
          </View>
        </View>
      </ScrollView>
      <FooterNav />
    </ScreenWrapper>
  );
};

export default UserProfile;

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  avatarContainer: {
    height: hp(12),
    width: hp(12),
    alignSelf: "center",
  },
  userName: {
    fontSize: hp(3),
    fontWeight: theme.fonts.bold,
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
    fontWeight: theme.fonts.medium,
    color: theme.colors.textLight,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  followButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.semibold,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  messageButtonText: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.semibold,
  },
  bioContainer: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(3),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radius.md,
    marginVertical: hp(1),
  },
  bioLabel: {
    fontSize: hp(1.6),
    fontWeight: theme.fonts.semibold,
    marginBottom: hp(0.5),
  },
  noInfoContainer: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(4),
  },
  privacyNotice: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(3),
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    marginVertical: hp(1),
  },
  privacyText: {
    fontSize: hp(1.6),
    fontWeight: theme.fonts.medium,
    textAlign: 'center',
  },
});