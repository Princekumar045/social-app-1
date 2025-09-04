import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SearchIcon from '../../assets/icons/Search';
import Avatar from '../../components/Avatar';
import ConversationHistory from '../../components/ConversationHistory';
import FooterNav from '../../components/FooterNav';
import Header from '../../components/Header';
import Loading from '../../components/Loading';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { hp, wp } from '../../helpers/common';
import { getOrCreateConversation, getUserProfile } from '../../services/messageService';
import { useRealtimeMessaging } from '../../services/useRealtimeMessaging';
import { searchUsers } from '../../services/userServices';

const Messenger = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState('conversations'); // 'conversations' or 'search'

  // Use the real-time messaging hook
  const {
    conversations,
    unreadCount,
    notifications,
    loading: realtimeLoading,
    fetchConversations,
    markConversationAsRead,
    clearNotification,
    clearAllNotifications
  } = useRealtimeMessaging(user?.id);

  useEffect(() => {
    setLoading(realtimeLoading);
  }, [realtimeLoading]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations().finally(() => setRefreshing(false));
  };

  // Handle notification press
  const handleNotificationPress = (notification) => {
    if (notification.type === 'message' && notification.data?.conversationId) {
      router.push({
        pathname: '/main/chat',
        params: {
          conversationId: notification.data.conversationId,
          otherUserId: notification.data.senderId
        }
      });
    }
  };

  // Search functionality
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        setViewMode('search');
        handleSearch();
      } else {
        setViewMode('conversations');
        setSearchResults([]);
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.id) return;
    
    setSearching(true);
    const response = await searchUsers(searchQuery.trim(), user.id);
    if (response.success) {
      setSearchResults(response.data || []);
    }
    setSearching(false);
  };

  const handleConversationSelect = async (conversation) => {
    try {
      // Mark conversation as read when selected
      if (conversation.unread_count > 0) {
        markConversationAsRead(conversation.id);
      }
      
      const otherParticipantId = conversation.participant1_id === user?.id 
        ? conversation.participant2_id 
        : conversation.participant1_id;

      // Fetch fresh user details for better display
      const userResponse = await getUserProfile(otherParticipantId);
      const otherUser = userResponse.success ? userResponse.data : null;

      const otherUserName = otherUser?.username ? `@${otherUser.username}` : (otherUser?.name || conversation.otherParticipant?.name || 'Unknown User');
      const otherUserImage = otherUser?.image || conversation.otherParticipant?.image || null;
      
      // Navigate to chat with detailed user info
      router.push({
        pathname: '/main/chat',
        params: {
          conversationId: conversation.id,
          otherUserId: otherParticipantId,
          otherUserName,
          otherUserImage
        }
      });
    } catch (error) {
      console.log('Error in handleConversationSelect:', error);
      // Fallback to basic conversation selection
      router.push({
        pathname: '/main/chat',
        params: {
          conversationId: conversation.id,
          otherUserId: conversation.otherParticipant?.id,
          otherUserName: conversation.otherParticipant?.username ? `@${conversation.otherParticipant.username}` : (conversation.otherParticipant?.name || 'Unknown User'),
          otherUserImage: conversation.otherParticipant?.image
        }
      });
    }
  };

  const startConversationWithUser = async (selectedUser) => {
    if (!user?.id || !selectedUser?.id) {
      alert('Error: User information missing. Please log in again.');
      return;
    }
    
    console.log('Starting conversation with user:', selectedUser.username ? `@${selectedUser.username}` : selectedUser.name, selectedUser.id);
    
    const response = await getOrCreateConversation(user.id, selectedUser.id);
    console.log('Conversation response:', response);
    
    if (response.success) {
      // Clear search and navigate to chat
      setSearchQuery('');
      setViewMode('conversations');
      router.push({
        pathname: '/main/chat',
        params: {
          conversationId: response.data,
          otherUserId: selectedUser.id,
          otherUserName: selectedUser.username ? `@${selectedUser.username}` : selectedUser.name,
          otherUserImage: selectedUser.image
        }
      });
    } else {
      console.log('Failed to create conversation:', response.msg);
      const errorMsg = response.msg || 'Unknown error occurred';
      
      if (errorMsg.includes('Database tables not set up')) {
        alert('Database setup required: Please run the SQL setup script in your Supabase dashboard. Check the MESSAGING_TROUBLESHOOTING.md file for instructions.');
      } else if (errorMsg.includes('relation "conversations" does not exist')) {
        alert('Database tables missing: The messaging tables have not been created. Please run database/messages_setup_simple.sql in your Supabase SQL editor.');
      } else {
        alert(`Failed to start conversation: ${errorMsg}`);
      }
    }
  };

  const openConversation = (conversation) => {
    router.push({
      pathname: '/main/chat',
      params: {
        conversationId: conversation.id,
        otherUserId: conversation.otherParticipant.id,
        otherUserName: conversation.otherParticipant.username ? `@${conversation.otherParticipant.username}` : conversation.otherParticipant.name,
        otherUserImage: conversation.otherParticipant.image
      }
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return '1d';
      if (diffInDays < 7) return `${diffInDays}d`;
      return date.toLocaleDateString();
    }
  };

  const renderConversation = ({ item }) => {
    const otherUser = item.otherParticipant;
    const isOnline = item.is_online || Math.random() > 0.5; // Use real online status when available
    const unreadCount = item.unread_count || 0;
    
    return (
      <Pressable 
        style={[styles.conversationItem, unreadCount > 0 && styles.unreadConversation]}
        onPress={() => openConversation(item)}
        onLongPress={() => router.push(`/main/userProfile?id=${otherUser?.id}`)}
        delayLongPress={500}
      >
        <View style={styles.avatarContainer}>
          <Avatar 
            uri={otherUser?.image} 
            size={60} 
            rounded={theme.radius.md}
          />
          {isOnline && <View style={styles.onlineIndicator} />}
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, unreadCount > 0 && styles.unreadUserName]}>
              {otherUser?.username ? `@${otherUser.username}` : (otherUser?.name || 'Unknown User')}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.updated_at)}</Text>
          </View>
          
          <Text style={styles.userEmail} numberOfLines={1}>
            {isOnline ? '🟢 Active now' : `Last seen ${formatTime(item.last_seen || item.updated_at)}`}
          </Text>
          
          <View style={styles.lastMessageContainer}>
            <Text style={[styles.lastMessage, unreadCount > 0 && styles.unreadLastMessage]} numberOfLines={1}>
              {item.last_message || 'Tap to start messaging'}
            </Text>
            {unreadCount === 0 && item.last_message && (
              <Ionicons 
                name="checkmark-done" 
                size={14} 
                color={theme.colors.primary} 
                style={styles.readIndicator} 
              />
            )}
          </View>
          
          {otherUser?.bio && (
            <Text style={styles.userBio} numberOfLines={1}>
              💬 {otherUser.bio}
            </Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.cameraButton}
          onPress={() => {
            // TODO: Implement camera functionality
            console.log('Camera pressed for', otherUser?.username ? `@${otherUser.username}` : otherUser?.name);
          }}
        >
          <Ionicons name="camera" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </Pressable>
    );
  };

  const renderSearchResult = ({ item }) => {
    return (
      <Pressable 
        style={styles.searchResultItem}
        onPress={() => startConversationWithUser(item)}
        onLongPress={() => router.push(`/main/userProfile?id=${item?.id}`)}
        delayLongPress={500}
      >
        <Avatar 
          uri={item?.image} 
          size={45} 
          rounded={theme.radius.md}
        />
        <View style={styles.searchResultContent}>
          <Text style={styles.searchUserName}>
            {item?.username ? `@${item.username}` : (item?.name || 'Unknown User')}
          </Text>
          {item?.username && item?.name && (
            <Text style={styles.searchUserUsername}>{item.name}</Text>
          )}
          <Text style={styles.searchUserEmail}>{item?.email}</Text>
          {item?.bio && (
            <Text style={styles.searchUserBio} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
          {item?.phoneNumber && (
            <Text style={styles.searchUserPhone}>{item.phoneNumber}</Text>
          )}
        </View>
        <Pressable 
          style={styles.messageButton}
          onPress={() => startConversationWithUser(item)}
        >
          <Text style={styles.messageButtonText}>Message</Text>
        </Pressable>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <ScreenWrapper bg="white">
        <Header title="Messages" />
        <Loading />
        <FooterNav />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper bg="white">
      <Header title="Messages" />
      
      <View style={styles.container}>
        {/* Search Section */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <SearchIcon size={20} color={theme.colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people..."
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setShowSearch(true)}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => {
                setSearchQuery('');
                setShowSearch(false);
              }}>
                <Text style={styles.clearButton}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Main Content */}
        {viewMode === 'search' && searchQuery.length > 0 ? (
          /* Search Results */
          <View style={styles.searchResultsContainer}>
            {searching ? (
              <View style={styles.searchingContainer}>
                <Loading />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                showsVerticalScrollIndicator={false}
                style={styles.searchResultsList}
              />
            ) : (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No users found</Text>
              </View>
            )}
          </View>
        ) : (
          /* Conversation History */
          <ConversationHistory
            user={user}
            onConversationSelect={handleConversationSelect}
            searchQuery={searchQuery}
          />
        )}
      </View>
      
      <FooterNav />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(4),
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  conversationContent: {
    flex: 1,
    marginLeft: wp(3),
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.3),
  },
  userName: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
  },
  timeText: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
  },
  userEmail: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    marginBottom: hp(0.2),
  },
  lastMessage: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginBottom: hp(0.2),
  },
  userBio: {
    fontSize: hp(1.3),
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
  conversationMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(1),
  },
  unreadText: {
    color: 'white',
    fontSize: hp(1.2),
    fontWeight: theme.fonts.bold,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  emptyTitle: {
    fontSize: hp(2.2),
    fontWeight: theme.fonts.bold,
    color: theme.colors.text,
    marginBottom: hp(1),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: hp(2.2),
  },
  // Search styles
  searchContainer: {
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.grayLight,
    borderRadius: theme.radius.xl,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  searchInput: {
    flex: 1,
    marginLeft: wp(2),
    fontSize: hp(1.8),
    color: theme.colors.text,
  },
  clearButton: {
    fontSize: hp(2),
    color: theme.colors.textLight,
    fontWeight: 'bold',
  },
  searchResultsContainer: {
    flex: 1,
    marginTop: hp(1),
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray,
  },
  searchResultContent: {
    flex: 1,
    marginLeft: wp(3),
  },
  searchUserName: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
  },
  searchUserUsername: {
    fontSize: hp(1.5),
    color: theme.colors.primary,
    fontWeight: theme.fonts.medium,
    marginTop: hp(0.1),
  },
  searchUserEmail: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
  },
  searchUserBio: {
    fontSize: hp(1.3),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
    fontStyle: 'italic',
  },
  searchUserPhone: {
    fontSize: hp(1.3),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
  },
  messageButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: theme.radius.md,
  },
  messageButtonText: {
    fontSize: hp(1.4),
    color: 'white',
    fontWeight: theme.fonts.medium,
  },
  messageText: {
    fontSize: hp(1.6),
    color: theme.colors.primary,
    fontWeight: theme.fonts.medium,
  },
  searchingContainer: {
    alignItems: 'center',
    paddingVertical: hp(4),
  },
  searchingText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(1),
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: hp(4),
  },
  noResultsText: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
  },
});

export default Messenger;