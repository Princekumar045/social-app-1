import { Video } from 'expo-av';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from '../../assets/icons';
import SearchIcon from '../../assets/icons/Search';
import Avatar from '../../components/Avatar';
import FooterNav from '../../components/FooterNav';
import Loading from '../../components/Loading';
import ScreenWrapper from '../../components/ScreenWrapper';
import { getTheme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hp, wp } from '../../helpers/common';
import { getSupabaseFileUrl } from '../../services/imageServices';
import { fetchCelebrityPosts, fetchPost } from '../../services/postService';
import { getTopUsersByFollowers, searchUsers } from '../../services/userServices';

const { width } = Dimensions.get('window');

const Search = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [explorePosts, setExplorePosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Celebrity Posts state
  const [showCelebrityPosts, setShowCelebrityPosts] = useState(false);
  const [celebrityPosts, setCelebrityPosts] = useState([]);
  const [celebrityUsers, setCelebrityUsers] = useState([]);
  const [celebrityLoading, setCelebrityLoading] = useState(false);
  
  const { isDarkMode } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);

  // Fetch explore posts on mount
  useEffect(() => {
    fetchExplorePosts();
  }, []);

  // Memoized calculations for performance
  const { itemSize, numColumns } = useMemo(() => {
    if (Platform.OS === 'web') {
      if (width >= 1200) return { itemSize: (width - 40) / 4, numColumns: 4 };
      if (width >= 768) return { itemSize: (width - 30) / 3, numColumns: 3 };
      return { itemSize: (width - 20) / 2, numColumns: 2 };
    }
    return { itemSize: (width - 6) / 3, numColumns: 3 };
  }, [width]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !currentUser?.id) {
      setIsSearchActive(false);
      setSearchResults([]);
      return;
    }

    setIsSearchActive(true);
    setSearchLoading(true);
    
    try {
      // Clean the search query - remove @ symbol if user typed it
      let cleanQuery = searchQuery.trim();
      if (cleanQuery.startsWith('@')) {
        cleanQuery = cleanQuery.substring(1);
      }
      
      const result = await searchUsers(cleanQuery, currentUser.id);
      if (result.success) {
        // Sort results to prioritize username matches
        const sortedResults = (result.data || []).sort((a, b) => {
          const aUsernameMatch = a.username && a.username.toLowerCase().includes(cleanQuery.toLowerCase());
          const bUsernameMatch = b.username && b.username.toLowerCase().includes(cleanQuery.toLowerCase());
          
          // Prioritize username matches
          if (aUsernameMatch && !bUsernameMatch) return -1;
          if (!aUsernameMatch && bUsernameMatch) return 1;
          
          // Then exact username matches
          if (a.username && a.username.toLowerCase() === cleanQuery.toLowerCase()) return -1;
          if (b.username && b.username.toLowerCase() === cleanQuery.toLowerCase()) return 1;
          
          // Then partial username matches
          if (aUsernameMatch && bUsernameMatch) {
            const aIndex = a.username ? a.username.toLowerCase().indexOf(cleanQuery.toLowerCase()) : -1;
            const bIndex = b.username ? b.username.toLowerCase().indexOf(cleanQuery.toLowerCase()) : -1;
            return aIndex - bIndex;
          }
          
          return 0;
        });
        
        setSearchResults(sortedResults);
      } else {
        console.error('Search failed:', result.msg);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, currentUser?.id]);

  // Debounced search with cleanup
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setIsSearchActive(false);
        setSearchResults([]);
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const fetchExplorePosts = async () => {
    setLoading(true);
    try {
      const res = await fetchPost(50); // Fetch more posts for explore
      if (res.success) {
        // Filter posts with media for explore feed
        const postsWithMedia = res.data.filter(post => post.file);
        // Sort by number of likes (descending)
        const sorted = postsWithMedia.sort((a, b) => {
          const aLikes = Array.isArray(a.postLikes) ? a.postLikes.length : 0;
          const bLikes = Array.isArray(b.postLikes) ? b.postLikes.length : 0;
          return bLikes - aLikes;
        });
        setExplorePosts(sorted);
      }
    } catch (error) {
      console.error('Error fetching explore posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get celebrity posts from top users with most followers
  const getCelebrityPosts = async () => {
    setCelebrityLoading(true);
    console.log('🌟 Fetching celebrity posts...');
    
    try {
      // First get top users by followers
      const topUsersRes = await getTopUsersByFollowers(3);
      
      if (topUsersRes.success && topUsersRes.data.length > 0) {
        setCelebrityUsers(topUsersRes.data);
        const celebrityUserIds = topUsersRes.data.map(user => user.id);
        
        // Then get posts from these users
        const celebrityPostsRes = await fetchCelebrityPosts(celebrityUserIds, 20);
        
        if (celebrityPostsRes.success) {
          console.log('🌟 Celebrity posts fetched:', celebrityPostsRes.data.length);
          setCelebrityPosts(celebrityPostsRes.data || []);
        } else {
          console.log('Failed to fetch celebrity posts:', celebrityPostsRes.msg);
          setCelebrityPosts([]);
        }
      } else {
        console.log('No celebrity users found or error:', topUsersRes.msg);
        setCelebrityPosts([]);
      }
    } catch (error) {
      console.error('Error fetching celebrity posts:', error);
      setCelebrityPosts([]);
    }
    
    setCelebrityLoading(false);
  };

  // Toggle between regular posts and celebrity posts
  const toggleCelebrityPosts = () => {
    const newShowCelebrity = !showCelebrityPosts;
    setShowCelebrityPosts(newShowCelebrity);
    
    if (newShowCelebrity) {
      getCelebrityPosts();
    }
  };

  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleSearchBlur = () => {
    if (!searchQuery.trim()) {
      setIsSearchActive(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchActive(false);
    setSearchResults([]);
  };

  // Web-specific keyboard handling
  const handleKeyDown = (event) => {
    if (Platform.OS === 'web') {
      if (event.key === 'Escape') {
        clearSearch();
      } else if (event.key === 'Enter' && searchResults.length > 0) {
        // Navigate to first search result
        handleUserPress(searchResults[0]);
      }
    }
  };

  const getMediaUrl = (file) => {
    if (!file) return null;
    
    if (typeof file === 'string') {
      return getSupabaseFileUrl(file);
    }
    
    if (typeof file === 'object' && file.uri) {
      return file;
    }
    
    return null;
  };

  const isVideo = (file) => {
    if (!file) return false;
    
    if (typeof file === 'string') {
      return file.match(/\.(mp4|mov|avi|webm)$/i);
    }
    if (typeof file === 'object' && file !== null && file.type) {
      return file.type.startsWith('video/');
    }
    return false;
  };

  const handlePostPress = (post) => {
    // Navigate to post detail
    router.push(`/main/postDetail?postId=${post.id}`);
  };

  const handleUserPress = (user) => {
    router.push(`/main/userProfile?id=${user.id}`);
  };

  const renderExploreItem = ({ item, index }) => {
    // Safety check for item
    if (!item) return null;
    
    const mediaUrl = getMediaUrl(item.file);
    const isVideoFile = isVideo(item.file);

    return (
      <TouchableOpacity 
        style={[styles.exploreItem, { width: itemSize, height: itemSize }]}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.8}
      >
        {isVideoFile ? (
          <View style={styles.mediaContainer}>
            {Platform.OS === 'web' ? (
              // Use HTML5 video for web
              <video
                src={mediaUrl?.uri || mediaUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none'
                }}
                muted
                playsInline
              />
            ) : (
              // Use expo-av Video for mobile
              <Video
                source={mediaUrl}
                style={styles.media}
                resizeMode="cover"
                shouldPlay={false}
                isLooping={false}
                useNativeControls={false}
              />
            )}
            <View style={styles.videoOverlay}>
              <Text style={styles.videoIcon}>▶</Text>
            </View>
          </View>
        ) : mediaUrl ? (
          <Image 
            source={mediaUrl} 
            style={styles.media}
            resizeMode="cover"
          />
        ) : (
          // Fallback for posts without media
          <View style={[styles.media, { backgroundColor: theme.colors.gray, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.textLight, fontSize: hp(1.5) }}>
              {item.body ? item.body.substring(0, 50) + '...' : 'No Media'}
            </Text>
          </View>
        )}
        
        {/* User info overlay */}
        <View style={styles.postUserOverlay}>
          <TouchableOpacity 
            style={styles.userInfoContainer}
            onPress={(e) => {
              e.stopPropagation(); // Prevent post navigation
              handleUserPress({ id: item.users?.id || item.userid });
            }}
            activeOpacity={0.8}
          >
            <Avatar 
              uri={item.users?.image} 
              size={hp(3)} 
              rounded={hp(1.5)} 
              style={styles.miniAvatar}
            />
            <Text style={styles.overlayUsername} numberOfLines={1}>
              {item.users?.username ? `@${item.users.username}` : (item.users?.name || 'User')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => handleUserPress(item)}
      onLongPress={() => handleUserPress(item)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <Avatar 
        uri={item.image} 
        size={hp(6)} 
        rounded={hp(3)} 
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {item.username ? `@${item.username}` : item.name}
        </Text>
        {item.name && item.username && (
          <Text style={styles.userRealName}>{item.name}</Text>
        )}
        {item.email && (
          <Text style={styles.userEmail}>{item.email}</Text>
        )}
        {item.bio && (
          <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCelebrityPostItem = ({ item, index }) => {
    // Safety check for item
    if (!item) return null;
    
    const mediaUrl = getMediaUrl(item.file);
    const isVideoFile = isVideo(item.file);

    return (
      <TouchableOpacity 
        style={[styles.exploreItem, { width: itemSize, height: itemSize }]}
        onPress={() => handlePostPress(item)}
        activeOpacity={0.8}
      >
        {isVideoFile ? (
          <View style={styles.mediaContainer}>
            {Platform.OS === 'web' ? (
              // Use HTML5 video for web
              <video
                src={mediaUrl?.uri || mediaUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none'
                }}
                muted
                playsInline
              />
            ) : (
              // Use expo-av Video for mobile
              <Video
                source={mediaUrl}
                style={styles.media}
                resizeMode="cover"
                shouldPlay={false}
                isLooping={false}
                useNativeControls={false}
              />
            )}
            <View style={styles.videoOverlay}>
              <Text style={styles.videoIcon}>▶</Text>
            </View>
            {/* Celebrity star badge for videos */}
            <View style={styles.celebrityBadge}>
              <Icon
                name="star"
                size={hp(1.5)}
                strokeWidth={2}
                color="white"
              />
            </View>
          </View>
        ) : mediaUrl ? (
          <>
            <Image 
              source={mediaUrl} 
              style={styles.media}
              resizeMode="cover"
            />
            {/* Celebrity star badge for images */}
            <View style={styles.celebrityBadge}>
              <Icon
                name="star"
                size={hp(1.5)}
                strokeWidth={2}
                color="white"
              />
            </View>
          </>
        ) : (
          // Fallback for posts without media
          <View style={[styles.media, { backgroundColor: theme.colors.gray, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.textLight, fontSize: hp(1.5) }}>
              {item.body ? item.body.substring(0, 50) + '...' : 'No Media'}
            </Text>
            {/* Celebrity star badge for text posts */}
            <View style={styles.celebrityBadge}>
              <Icon
                name="star"
                size={hp(1.5)}
                strokeWidth={2}
                color="white"
              />
            </View>
          </View>
        )}
        
        {/* User info overlay */}
        <View style={styles.postUserOverlay}>
          <TouchableOpacity 
            style={styles.userInfoContainer}
            onPress={(e) => {
              e.stopPropagation(); // Prevent post navigation
              handleUserPress({ id: item.users?.id || item.userid });
            }}
            activeOpacity={0.8}
          >
            <Avatar 
              uri={item.users?.image} 
              size={hp(3)} 
              rounded={hp(1.5)} 
              style={styles.miniAvatar}
            />
            <Text style={styles.overlayUsername} numberOfLines={1}>
              {item.users?.username ? `@${item.users.username}` : (item.users?.name || 'User')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <View style={styles.container}>
        {/* Search Header */}
        <View style={styles.searchHeader}>
          <View style={styles.searchBarContainer}>
            <SearchIcon size={hp(2.5)} color={theme.colors.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by @username, name, or email"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              onKeyDown={Platform.OS === 'web' ? handleKeyDown : undefined}
              placeholderTextColor={theme.colors.textLight}
              returnKeyType="search"
              accessibilityLabel="Search users"
              accessibilityHint="Type to search for users by username, name, or email"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
            {searchLoading && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
          
          {/* Celebrity Posts Button */}
          {!isSearchActive && (
            <View style={styles.filterContainer}>
              <Pressable 
                onPress={toggleCelebrityPosts}
                style={[
                  styles.celebrityButton, 
                  { 
                    backgroundColor: showCelebrityPosts ? theme.colors.primary : theme.colors.gray + '20',
                    borderColor: showCelebrityPosts ? theme.colors.primary : theme.colors.gray + '40'
                  }
                ]}
                disabled={loading || celebrityLoading}
              >
                <Icon
                  name="star"
                  size={hp(2.5)}
                  strokeWidth={2}
                  color={showCelebrityPosts ? 'white' : theme.colors.text}
                />
                <Text style={[
                  styles.celebrityButtonText, 
                  { 
                    color: showCelebrityPosts ? 'white' : theme.colors.text,
                    fontWeight: showCelebrityPosts ? theme.fonts.bold : theme.fonts.medium
                  }
                ]}>
                  {showCelebrityPosts ? 'Show Explore' : 'Celebrity Posts'}
                </Text>
                {showCelebrityPosts && celebrityUsers.length > 0 && (
                  <View style={[styles.celebrityCount, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={styles.celebrityCountText}>{celebrityUsers.length}</Text>
                  </View>
                )}
                {(loading || celebrityLoading) && (
                  <View style={styles.buttonLoading}>
                    <Loading size="small" />
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {isSearchActive ? (
            // Search Results - User List
            <View style={styles.searchResults}>
              {searchQuery.trim() && (
                <View style={styles.searchInfo}>
                  <Text style={styles.recentText}>Recent</Text>
                  {searchResults.length > 0 && (
                    <TouchableOpacity>
                      <Text style={styles.seeAllText}>See All</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              <FlatList
                key="search-results"
                data={searchResults}
                keyExtractor={item => item.id.toString()}
                renderItem={renderUserItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.usersList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchLoading ? 'Searching...' : 
                       searchQuery ? 'No users found.' : 
                       'Start typing to search users'}
                    </Text>
                  </View>
                }
              />
            </View>
          ) : showCelebrityPosts ? (
            // Celebrity Posts Grid (same layout as explore)
            <View style={styles.exploreContainer}>
              {celebrityLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Loading celebrity posts...</Text>
                </View>
              ) : (
                <FlatList
                  key={`celebrity-grid-${numColumns}`}
                  data={celebrityPosts}
                  keyExtractor={item => `celebrity-${item.id}`}
                  numColumns={numColumns}
                  renderItem={renderCelebrityPostItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.exploreGrid}
                  columnWrapperStyle={numColumns > 1 ? styles.exploreRow : null}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {celebrityLoading ? 'Loading celebrity posts...' : 'No celebrity posts available'}
                      </Text>
                    </View>
                  }
                  refreshing={celebrityLoading}
                  onRefresh={getCelebrityPosts}
                />
              )}
            </View>
          ) : (
            // Explore Feed - Instagram-like grid
            <View style={styles.exploreContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Loading explore feed...</Text>
                </View>
              ) : (
                <FlatList
                  key={`explore-grid-${numColumns}`}
                  data={explorePosts}
                  keyExtractor={item => item.id.toString()}
                  numColumns={numColumns}
                  renderItem={renderExploreItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.exploreGrid}
                  columnWrapperStyle={numColumns > 1 ? styles.exploreRow : null}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No posts to explore</Text>
                    </View>
                  }
                />
              )}
            </View>
          )}
        </View>
      </View>
      <FooterNav />
    </ScreenWrapper>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    ...Platform.select({
      web: {
        maxWidth: 1200,
        marginHorizontal: 'auto',
        minHeight: '100vh',
      },
    }),
  },
  contentContainer: {
    flex: 1,
    paddingBottom: Platform.OS === 'web' ? hp(2) : 0, // Extra padding for web
  },
  searchHeader: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: theme.colors.background,
      },
    }),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.darkLight,
    borderRadius: hp(1.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.2),
    gap: wp(2),
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: hp(2),
    color: theme.colors.text,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: wp(1),
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  clearButtonText: {
    fontSize: hp(2),
    color: theme.colors.textLight,
  },
  
  // Search Results Styles
  searchResults: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: 'calc(100vh - 200px)',
      },
    }),
  },
  searchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
  },
  recentText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: theme.colors.textDark,
  },
  seeAllText: {
    fontSize: hp(1.8),
    color: theme.colors.primary,
    fontWeight: '500',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  usersList: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(5), // Space for footer
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    gap: wp(3),
    ...Platform.select({
      web: {
        cursor: 'pointer',
        borderRadius: hp(1),
        paddingHorizontal: wp(2),
        transition: 'background-color 0.2s ease',
      },
    }),
  },
  userAvatar: {
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: hp(2),
    fontWeight: '600',
    color: theme.colors.primary, // Use primary color for usernames
  },
  userRealName: {
    fontSize: hp(1.7),
    fontWeight: '500',
    color: theme.colors.textDark,
    marginTop: hp(0.1),
  },
  userEmail: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
  },
  userBio: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
  },
  
  // Explore Feed Styles
  exploreContainer: {
    flex: 1,
    ...Platform.select({
      web: {
        minHeight: 'calc(100vh - 200px)',
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp(2),
    ...Platform.select({
      web: {
        minHeight: '50vh',
      },
    }),
  },
  loadingText: {
    fontSize: hp(2),
    color: theme.colors.textLight,
  },
  exploreGrid: {
    padding: 1,
    paddingBottom: hp(5), // Extra padding for footer
    ...Platform.select({
      web: {
        paddingBottom: hp(10), // Extra padding for web
      },
    }),
  },
  exploreRow: {
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        gap: 2, // Consistent gap for web
      },
    }),
  },
  exploreItem: {
    marginBottom: 2,
    backgroundColor: theme.colors.darkLight,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        borderRadius: 4,
        overflow: 'hidden',
      },
    }),
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    ...Platform.select({
      web: {
        overflow: 'hidden',
      },
    }),
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    ...Platform.select({
      web: {
        transition: 'opacity 0.2s ease',
      },
    }),
  },
  videoIcon: {
    color: 'white',
    fontSize: hp(3),
    ...Platform.select({
      web: {
        userSelect: 'none',
      },
    }),
  },
  
  // User overlay styles for explore posts
  postUserOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: wp(2),
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  miniAvatar: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  overlayUsername: {
    color: 'white',
    fontSize: hp(1.4),
    fontWeight: '500',
    flex: 1,
    ...Platform.select({
      web: {
        userSelect: 'none',
      },
    }),
  },
  
  // Common Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(10),
    ...Platform.select({
      web: {
        minHeight: '40vh',
      },
    }),
  },
  emptyText: {
    fontSize: hp(2),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  
  // Error boundary styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(4),
    ...Platform.select({
      web: {
        minHeight: '60vh',
      },
    }),
  },
  errorText: {
    fontSize: hp(2.2),
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: hp(3),
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.5),
    borderRadius: hp(1),
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
      },
    }),
  },
  retryButtonText: {
    color: 'white',
    fontSize: hp(2),
    fontWeight: '600',
  },
  
  // Celebrity Posts Styles
  filterContainer: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    backgroundColor: theme.colors.background,
  },
  celebrityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(4),
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: hp(1),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  celebrityButtonText: {
    fontSize: hp(1.8),
    textAlign: 'center',
  },
  celebrityCount: {
    paddingHorizontal: hp(0.8),
    paddingVertical: hp(0.3),
    borderRadius: hp(1),
    minWidth: hp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrityCountText: {
    color: 'white',
    fontSize: hp(1.4),
    fontWeight: 'bold',
  },
  buttonLoading: {
    marginLeft: hp(1),
  },
  celebrityBadge: {
    position: 'absolute',
    top: hp(1),
    right: hp(1),
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: hp(1),
    padding: hp(0.3),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default Search;