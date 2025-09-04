import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
import ScreenWrapper from '../../components/ScreenWrapper';
import { getTheme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useFollow } from '../../contexts/FollowContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hp, wp } from '../../helpers/common';
import { followUser, getFollowersList, getFollowingList, isFollowing, unfollowUser } from '../../services/userServices';

const FollowList = () => {
  const { userId, type, userName } = useLocalSearchParams(); // type: 'followers' or 'following'
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const { getFollowData, handleFollowAction, addFollowListener } = useFollow();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingStatus, setFollowingStatus] = useState({}); // Track who current user is following

  useEffect(() => {
    fetchUsersList();
  }, [userId, type]);

  // Listen for real-time follow updates
  useEffect(() => {
    const cleanup = addFollowListener((event) => {
      // Update follow status for any user in the list
      setFollowingStatus(prev => ({
        ...prev,
        [event.targetUserId]: event.newFollowStatus
      }));
    });

    return cleanup;
  }, []);

  const fetchUsersList = async () => {
    if (!userId) {
      console.error('❌ No userId provided to fetchUsersList');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let result;
      if (type === 'followers') {
        result = await getFollowersList(userId);
      } else {
        result = await getFollowingList(userId);
      }
      
      if (result.success) {
        console.log('📋 Fetched users data:', result.data);
        
        // Filter out any null/undefined users and ensure uniqueness
        const validUsers = (result.data || []).filter(user => user && user.id);
        const uniqueUsers = validUsers.filter((user, index, self) => 
          index === self.findIndex(u => u.id === user.id)
        );
        
        console.log('📋 Valid unique users:', uniqueUsers);
        setUsers(uniqueUsers);
        
        // Check follow status for each user
        if (currentUser?.id) {
          await checkFollowStatus(uniqueUsers);
        }
      } else {
        console.error('Failed to fetch users list:', result.msg);
        setUsers([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching users list:', error);
      setUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async (usersList) => {
    if (!currentUser?.id || !Array.isArray(usersList)) {
      console.error('❌ Invalid parameters for checkFollowStatus');
      return;
    }
    
    const statusMap = {};
    
    for (const user of usersList) {
      if (user && user.id && user.id !== currentUser.id) {
        try {
          const result = await isFollowing(currentUser.id, user.id);
          if (result.success) {
            statusMap[user.id] = result.following;
          } else {
            console.error(`Failed to check follow status for user ${user.id}:`, result.msg);
            statusMap[user.id] = false; // Default to not following on error
          }
        } catch (error) {
          console.error(`Error checking follow status for user ${user.id}:`, error);
          statusMap[user.id] = false; // Default to not following on error
        }
      }
    }
    
    setFollowingStatus(statusMap);
  };

  const handleFollow = async (targetUser) => {
    if (!currentUser?.id || targetUser.id === currentUser.id) return;
    
    const isCurrentlyFollowing = followingStatus[targetUser.id];
    
    // Optimistically update UI
    setFollowingStatus(prev => ({
      ...prev,
      [targetUser.id]: !isCurrentlyFollowing
    }));
    
    try {
      let result;
      const updateCallback = async (targetUserId, isFollowing) => {
        // Trigger context update for real-time sync
        handleFollowAction(currentUser.id, targetUserId, isFollowing);
      };

      if (isCurrentlyFollowing) {
        result = await unfollowUser(currentUser.id, targetUser.id, updateCallback);
      } else {
        result = await followUser(currentUser.id, targetUser.id, updateCallback);
      }
      
      if (!result.success) {
        // Revert optimistic update on failure
        setFollowingStatus(prev => ({
          ...prev,
          [targetUser.id]: isCurrentlyFollowing
        }));
        console.error('Follow action failed:', result.msg);
      }
    } catch (error) {
      // Revert optimistic update on error
      setFollowingStatus(prev => ({
        ...prev,
        [targetUser.id]: isCurrentlyFollowing
      }));
      console.error('Error toggling follow:', error);
    }
  };

  const renderUserItem = ({ item }) => {
    const isOwnProfile = item.id === currentUser?.id;
    const isFollowingThisUser = followingStatus[item.id];

    return (
      <View style={styles.userItem}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => router.push(`/main/userProfile?id=${item.id}`)}
          onLongPress={() => router.push(`/main/userProfile?id=${item.id}`)}
          delayLongPress={500}
        >
          <Avatar
            uri={item.image}
            size={hp(6)}
            rounded={theme.radius.md}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {item.username ? `@${item.username}` : item.name}
            </Text>
            {item.username && item.name && (
              <Text style={styles.userRealName}>{item.name}</Text>
            )}
            {item.bio && (
              <Text style={styles.userBio} numberOfLines={1}>
                {item.bio}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        {!isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowingThisUser && styles.followingButton
            ]}
            onPress={() => handleFollow(item)}
          >
            <Text style={[
              styles.followButtonText,
              isFollowingThisUser && styles.followingButtonText
            ]}>
              {isFollowingThisUser ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getTitle = () => {
    const baseTitle = type === 'followers' ? 'Followers' : 'Following';
    return userName ? `${userName.startsWith('@') ? userName : `@${userName}`}'s ${baseTitle}` : baseTitle;
  };

  if (loading) {
    return (
      <ScreenWrapper bg={theme.colors.background}>
        <Header title={getTitle()} showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading {type}...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <Header title={getTitle()} showBackButton />
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
};

const getStyles = (theme) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: hp(2),
    color: theme.colors.textLight,
  },
  listContainer: {
    padding: wp(4),
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(2),
    marginBottom: hp(1),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: wp(3),
    flex: 1,
  },
  userName: {
    fontSize: hp(2),
    fontWeight: '600',
    color: theme.colors.primary,
  },
  userRealName: {
    fontSize: hp(1.7),
    fontWeight: '400',
    color: theme.colors.textLight,
    marginTop: 2,
  },
  userBio: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: 2,
  },
  followButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: theme.radius.sm,
    minWidth: wp(20),
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  followButtonText: {
    color: theme.colors.white,
    fontSize: hp(1.6),
    fontWeight: '600',
  },
  followingButtonText: {
    color: theme.colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(10),
  },
  emptyText: {
    fontSize: hp(2),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
});

export default FollowList;
