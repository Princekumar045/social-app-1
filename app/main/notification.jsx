import { useRouter } from 'expo-router';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../assets/icons';
import Avatar from '../../components/Avatar';
import Header from '../../components/Header';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { hp, wp } from '../../helpers/common';
import { useRealtimeNotifications } from '../../services/useRealtimeNotifications';

const NotificationItem = ({ item, onPress, onRead }) => {
  const router = useRouter();
  
  const getNotificationIcon = () => {
    switch (item.title) {
      case 'liked your post':
        return (
          <View style={styles.messageIconContainer}>
            <Icon name="mail" size={hp(1.6)} color="white" />
          </View>
        );
      case 'commented on your post':
        return (
          <View style={styles.commentIconContainer}>
            <Icon name="comment" size={hp(1.6)} color="white" />
          </View>
        );
      default:
        return (
          <View style={styles.defaultIconContainer}>
            <Icon name="bell" size={hp(1.6)} color="white" />
          </View>
        );
    }
  };

  const handleAvatarPress = () => {
    if (item.sender?.id) {
      router.push({
        pathname: "/main/userProfile",
        params: { userId: item.sender.id }
      });
    }
  };

  // Enhanced display name logic - use real user data from users table
  const displayName = 
    (item.sender?.username ? `@${item.sender.username}` : item.sender?.name) || 
    `User ${item.sender?.id?.slice(0, 8) || 'Unknown'}`;
  
  const realName = item.sender?.username && item.sender?.name ? item.sender.name : null;
  
  // Enhanced avatar URL with fallback to generated avatar
  const avatarUrl = 
    item.sender?.avatar_url || 
    item.sender?.image ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.sender?.id || 'default'}`;

  // Debug logging for troubleshooting
  if (__DEV__) {
    console.log(`🔍 NotificationItem Debug:`, {
      senderId: item.sender?.id?.slice(0, 8),
      senderName: item.sender?.username ? `@${item.sender.username}` : item.sender?.name,
      finalDisplayName: displayName,
      title: item.title
    });
  }

  return (
    <Pressable 
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => {
        if (!item.read) {
          onRead(item.id);
        }
        onPress(item);
      }}
    >
      {/* Avatar with Icon Overlay - Clickable */}
      <Pressable style={styles.avatarWrapper} onPress={handleAvatarPress}>
        <Avatar
          uri={avatarUrl}
          size={hp(5.5)}
          rounded={hp(2.75)}
        />
        {/* Small notification icon overlay */}
        <View style={styles.iconOverlay}>
          {getNotificationIcon()}
        </View>
      </Pressable>
      
      {/* Notification Text Content */}
      <View style={styles.textContent}>
        <Text style={styles.notificationText}>
          <Text style={styles.senderName}>{displayName}</Text>
          {realName && <Text style={styles.usernameText}> {realName}</Text>}
          <Text style={styles.actionText}> {item.title}</Text>
        </Text>
        <Text style={styles.timeText}>
          {moment(item.created_at).fromNow()}
        </Text>
      </View>

      {/* Unread Indicator */}
      {!item.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
};

const Notifications = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    refetch 
  } = useRealtimeNotifications(user?.id);

  // Debug logging
  console.log('🔍 Notification Page Debug:');
  console.log('Total notifications:', notifications?.length || 0);
  if (notifications && notifications.length > 0) {
    console.log('First notification sender:', notifications[0].sender);
    console.log('First notification sender name:', notifications[0].sender?.username ? `@${notifications[0].sender.username}` : notifications[0].sender?.name);
  }

  const handleNotificationPress = (notification) => {
    try {
      const data = JSON.parse(notification.data);
      if (data.postId) {
        // Navigate to post detail
        router.push({
          pathname: "/main/postDetail",
          params: { postId: data.postId }
        });
      }
    } catch (error) {
      console.log('Error parsing notification data:', error);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 Force refreshing notifications...');
    setRefreshing(true);
    
    // Clear any potential cached state
    console.log('Before refresh - notifications count:', notifications?.length || 0);
    
    await refetch();
    
    console.log('After refresh - notifications count:', notifications?.length || 0);
    setRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount > 0) {
      await markAllAsRead();
    }
  };

  // Force refresh on mount to ensure fresh data
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 Component mounted, forcing refresh...');
      handleRefresh();
    }
  }, [user?.id]);

  const renderNotification = ({ item }) => (
    <NotificationItem
      item={item}
      onPress={handleNotificationPress}
      onRead={markAsRead}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="bell" size={hp(8)} color={theme.colors.textLight} />
      <Text style={styles.emptyText}>No notifications yet</Text>
      <Text style={styles.emptySubtext}>
        You'll see notifications when someone likes or comments on your posts
      </Text>
    </View>
  );

  return (
    <ScreenWrapper bg="white">
      <View style={styles.container}>
        <Header 
          title="Notifications" 
          showBackButton={true}
          mb={15}
        />

        {unreadCount > 0 && (
          <View style={styles.markAllContainer}>
            <Pressable style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderNotification}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={renderEmptyState}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

export default Notifications;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(4),
  },
  markAllContainer: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  markAllButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
  },
  markAllText: {
    color: 'white',
    fontSize: hp(1.6),
    fontWeight: theme.fonts.medium,
  },
  listContainer: {
    paddingVertical: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    backgroundColor: 'white',
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.gray + '30',
  },
  unreadNotification: {
    backgroundColor: '#f8f9fa',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: wp(3),
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: hp(1.2),
  },
  messageIconContainer: {
    width: hp(2.4),
    height: hp(2.4),
    borderRadius: hp(1.2),
    backgroundColor: '#ff3040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentIconContainer: {
    width: hp(2.4),
    height: hp(2.4),
    borderRadius: hp(1.2),
    backgroundColor: '#1877f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultIconContainer: {
    width: hp(2.4),
    height: hp(2.4),
    borderRadius: hp(1.2),
    backgroundColor: theme.colors.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: hp(1.7),
    lineHeight: hp(2.2),
    color: theme.colors.textDark,
    marginBottom: hp(0.3),
  },
  senderName: {
    fontWeight: '600',
    color: theme.colors.textDark,
  },
  usernameText: {
    fontWeight: '400',
    color: theme.colors.textLight,
    fontSize: hp(1.5),
  },
  actionText: {
    fontWeight: '400',
    color: theme.colors.textDark,
  },
  timeText: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    fontWeight: '400',
  },
  unreadDot: {
    width: wp(2),
    height: wp(2),
    borderRadius: wp(1),
    backgroundColor: '#1877f2',
    marginLeft: wp(2),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(10),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(15),
    paddingHorizontal: wp(8),
  },
  emptyText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: theme.colors.textDark,
    marginTop: hp(2),
    marginBottom: hp(1),
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: hp(2.2),
  },
  markAllContainer: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.gray + '30',
  },
  markAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: hp(0.8),
    paddingHorizontal: wp(3),
  },
  markAllText: {
    fontSize: hp(1.6),
    color: '#1877f2',
    fontWeight: '600',
  },
});