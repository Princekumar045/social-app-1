import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { hp, wp } from '../helpers/common';
import { getUserConversations } from '../services/messageService';
import Avatar from './Avatar';

const ConversationHistory = ({ user, onConversationSelect, searchQuery = '' }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchConversationHistory();
    }
  }, [user?.id]);

  const fetchConversationHistory = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const response = await getUserConversations(user.id);
      if (response.success) {
        // Sort conversations by most recent activity
        const sortedConversations = (response.data || []).sort((a, b) => {
          const aTime = new Date(a.updated_at || a.created_at);
          const bTime = new Date(b.updated_at || b.created_at);
          return bTime - aTime;
        });
        
        // Filter conversations based on search query
        const filteredConversations = searchQuery.trim() 
          ? sortedConversations.filter(conv => 
              conv.otherParticipant?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              conv.otherParticipant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : sortedConversations;
        
        setConversations(filteredConversations);
      } else {
        console.log('Error fetching conversations:', response.msg);
        setConversations([]);
      }
    } catch (error) {
      console.log('Exception fetching conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversationHistory();
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      
      return date.toLocaleDateString();
    } catch (error) {
      return '';
    }
  };

  const getOnlineStatus = (lastSeen) => {
    if (!lastSeen) return '⚫'; // Unknown
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = (now - lastSeenDate) / (1000 * 60);
    
    if (diffMinutes < 5) return '🟢'; // Online (last 5 minutes)
    if (diffMinutes < 60) return '🟡'; // Away (last hour)
    return '⚫'; // Offline
  };

  const renderConversationItem = ({ item, index }) => {
    const isLastItem = index === conversations.length - 1;
    const otherUser = item.otherParticipant || {};
    const unreadCount = item.unread_count || 0;
    const hasUnread = unreadCount > 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          hasUnread && styles.unreadConversation,
          isLastItem && styles.lastConversationItem
        ]}
        onPress={() => onConversationSelect && onConversationSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.conversationContent}>
          {/* Avatar with online status */}
          <View style={styles.avatarContainer}>
            <Avatar
              uri={otherUser.image}
              size={hp(6)}
              rounded={theme.radius.xl}
              style={styles.avatar}
            />
            <View style={[styles.onlineIndicator, { backgroundColor: getOnlineStatus(otherUser.last_seen) === '🟢' ? '#4CAF50' : '#757575' }]} />
          </View>

          {/* Conversation details */}
          <View style={styles.conversationDetails}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.participantName, hasUnread && styles.unreadName]} numberOfLines={1}>
                {otherUser.username ? `@${otherUser.username}` : (otherUser.name || 'Unknown User')}
              </Text>
              <View style={styles.timeAndStatus}>
                <Text style={[styles.timeText, hasUnread && styles.unreadTime]}>
                  {formatMessageTime(item.updated_at || item.created_at)}
                </Text>
                <Text style={styles.onlineStatus}>
                  {getOnlineStatus(otherUser.last_seen)}
                </Text>
              </View>
            </View>

            <View style={styles.messagePreview}>
              <Text 
                style={[styles.lastMessage, hasUnread && styles.unreadMessage]} 
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.last_message || 'No messages yet'}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>

            {/* Additional user info */}
            {otherUser.bio && (
              <Text style={styles.userBio} numberOfLines={1}>
                {otherUser.bio}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>💬</Text>
      <Text style={styles.emptyStateTitle}>No Conversations Yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery.trim() 
          ? `No conversations found for "${searchQuery}"`
          : 'Start a new conversation by searching for users above'
        }
      </Text>
    </View>
  );

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          conversations.length === 0 && styles.emptyListContainer
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  listContainer: {
    paddingHorizontal: wp(4),
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  loadingText: {
    fontSize: hp(2),
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
  },
  conversationItem: {
    backgroundColor: theme.colors.white,
    marginVertical: hp(0.5),
    borderRadius: theme.radius.xl,
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(3),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.gray,
  },
  unreadConversation: {
    backgroundColor: '#F8F9FF',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  lastConversationItem: {
    borderBottomWidth: 0,
    marginBottom: hp(2),
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: wp(3),
  },
  avatar: {
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  conversationDetails: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.5),
  },
  participantName: {
    fontSize: hp(2.1),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
    flex: 1,
    marginRight: wp(2),
  },
  unreadName: {
    fontWeight: theme.fonts.bold,
    color: theme.colors.dark,
  },
  timeAndStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginRight: wp(1),
  },
  unreadTime: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.medium,
  },
  onlineStatus: {
    fontSize: hp(1.4),
  },
  messagePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
    flex: 1,
    marginRight: wp(2),
  },
  unreadMessage: {
    color: theme.colors.text,
    fontWeight: theme.fonts.medium,
  },
  unreadBadge: {
    backgroundColor: theme.colors.rose,
    borderRadius: 10,
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    color: theme.colors.white,
    fontSize: hp(1.4),
    fontWeight: theme.fonts.bold,
  },
  userBio: {
    fontSize: hp(1.5),
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginTop: hp(0.3),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(8),
  },
  emptyStateIcon: {
    fontSize: hp(8),
    marginBottom: hp(2),
  },
  emptyStateTitle: {
    fontSize: hp(2.5),
    fontWeight: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: hp(1),
  },
  emptyStateSubtitle: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
    textAlign: 'center',
    paddingHorizontal: wp(8),
    lineHeight: hp(2.5),
  },
});

export default ConversationHistory;
