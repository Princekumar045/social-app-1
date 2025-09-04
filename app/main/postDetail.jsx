import { Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Image, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Icon from '../../assets/icons';
import Header from '../../components/Header';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { hp, wp } from '../../helpers/common';
import { getSupabaseFileUrl } from "../../services/imageServices";
import { createComment, createPostLike, fetchPost, removeComment, removePostLike, retryMissingProfiles } from "../../services/postService";
import { fetchPostCommentsSimple } from "../../services/postServiceSimple";

const AVATAR_PLACEHOLDER = 'https://ui-avatars.com/api/?name=User&background=eee&color=555&size=128';

// Helper function to get proper image URL
const getProfileImageUrl = (imageUrl) => {
  if (!imageUrl) return AVATAR_PLACEHOLDER;
  
  // If it's already a full HTTP URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // If it's a Supabase file path, convert it to proper URL
  if (imageUrl.includes('/') && !imageUrl.startsWith('http')) {
    const supabaseUrl = getSupabaseFileUrl(imageUrl);
    return supabaseUrl ? supabaseUrl.uri : AVATAR_PLACEHOLDER;
  }
  
  // Default fallback
  return AVATAR_PLACEHOLDER;
};

const PostDetail = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { postId, ids, index, userId } = useLocalSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPost, setCurrentPost] = useState(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [modalComments, setModalComments] = useState([]);
  const [likedPosts, setLikedPosts] = useState(new Set());
  const [newComment, setNewComment] = useState('');
  const [currentModalPostId, setCurrentModalPostId] = useState(null);
  const [needsCommentsRefresh, setNeedsCommentsRefresh] = useState(false);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      console.log('fetchPost: Fetching posts...');
      
      const { success, data } = await fetchPost(1000);
      console.log('fetchPost: Supabase response:', { data, error: success ? null : 'Failed to fetch' });
      
      if (success && data) {
        console.log('fetchPost: Returning data:', data);
        
        // If we have specific post IDs from UserPosts navigation
        if (ids) {
          const postIds = ids.split(',').map(id => parseInt(id, 10));
          const filteredPosts = data.filter(post => postIds.includes(post.id));
          setPosts(filteredPosts);
          
          // Set current post based on index
          if (index !== undefined) {
            const currentIndex = parseInt(index, 10);
            if (filteredPosts[currentIndex]) {
              setCurrentPost(filteredPosts[currentIndex]);
            }
          }
        } 
        // If we have a specific postId (from notifications)
        else if (postId) {
          const targetPost = data.find(post => String(post.id) === String(postId));
          if (targetPost) {
            // Show only the single post with the given postId
            setPosts([targetPost]);
            setCurrentPost(targetPost);
            console.log('Target post found:', targetPost.id);
          }
        }
        // If we have a userId (direct user profile navigation)
        else if (userId) {
          const userPosts = data.filter(post => String(post.userid) === String(userId));
          setPosts(userPosts);
          console.log('User posts found:', userPosts.length);
        }
        // Default: show current user's posts
        else if (user?.id) {
          const userPosts = data.filter(post => post.userid === user.id);
          setPosts(userPosts);
          console.log('User posts found:', userPosts.length);
        }
      }
      setLoading(false);
    };
    
    loadPosts();
  }, [user?.id, postId, ids, index, userId]);

  // Initialize liked posts when posts are loaded
  useEffect(() => {
    if (posts.length && user?.id) {
      const userLikedPosts = new Set();
      posts.forEach(post => {
        if (Array.isArray(post.postLikes)) {
          const userLike = post.postLikes.find(like => like.userId === user.id);
          if (userLike) {
            userLikedPosts.add(post.id);
          }
        }
      });
      setLikedPosts(userLikedPosts);
    }
  }, [posts, user?.id]);

  // Effect to retry loading comments when user becomes authenticated
  useEffect(() => {
    if (user?.id && needsCommentsRefresh && currentModalPostId && commentsModalVisible) {
      console.log('User authenticated, retrying comment load for post:', currentModalPostId);
      console.log('Authenticated user ID:', user.id);
      
      // Delay slightly to ensure auth is fully established
      setTimeout(() => {
        loadCommentsWithProfiles(currentModalPostId);
        setNeedsCommentsRefresh(false);
      }, 500);
    }
  }, [user?.id, needsCommentsRefresh, currentModalPostId, commentsModalVisible]);

  // Effect to refetch missing profiles when user becomes authenticated
  useEffect(() => {
    if (user?.id && modalComments.length > 0 && commentsModalVisible) {
      // Check if there are any comments with "Unknown User" or missing profile images
      const commentsWithMissingProfiles = modalComments.filter(
        comment => comment.users?.name === 'Unknown User' || 
                  comment.users?.image === null ||
                  !comment.users?.image ||
                  comment.needsProfileRetry
      );
      
      if (commentsWithMissingProfiles.length > 0) {
        console.log('Found', commentsWithMissingProfiles.length, 'comments with missing profiles');
        console.log('Missing profile user IDs:', commentsWithMissingProfiles.map(c => c.userId));
        console.log('Retrying profile fetch after authentication...');
        
        // Use the new retry function instead of refetching all comments
        setTimeout(async () => {
          try {
            const retryResult = await retryMissingProfiles(modalComments);
            
            if (retryResult.success) {
              console.log('Profile retry successful, updating comments');
              setModalComments(retryResult.data);
            } else {
              console.log('Profile retry failed:', retryResult.msg);
              // Fallback to full refetch
              loadCommentsWithProfiles(currentModalPostId);
            }
          } catch (error) {
            console.log('Error in profile retry:', error);
            // Fallback to full refetch
            loadCommentsWithProfiles(currentModalPostId);
          }
        }, 1000);
      }
    }
  }, [user?.id, modalComments, commentsModalVisible, currentModalPostId]);

  const handleLike = async (postId) => {
    if (!user?.id) return;
    
    const isLiked = likedPosts.has(postId);
    const newLikedPosts = new Set(likedPosts);
    
    if (isLiked) {
      // Remove like
      const result = await removePostLike(postId, user.id);
      if (result.success) {
        newLikedPosts.delete(postId);
        setLikedPosts(newLikedPosts);
        
        // Update posts state to reflect the change
        setPosts(prevPosts => prevPosts.map(post => 
          post.id === postId 
            ? { ...post, postLikes: post.postLikes.filter(like => like.userId !== user.id) }
            : post
        ));
      }
    } else {
      // Add like
      const result = await createPostLike({ postId, userId: user.id });
      if (result.success) {
        newLikedPosts.add(postId);
        setLikedPosts(newLikedPosts);
        
        // Update posts state to reflect the change
        setPosts(prevPosts => prevPosts.map(post => 
          post.id === postId 
            ? { ...post, postLikes: [...(post.postLikes || []), result.data] }
            : post
        ));
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!newComment.trim() || !user?.id) return;
    
    const result = await createComment({
      postId,
      userId: user.id,
      text: newComment.trim()
    });
    
    if (result.success) {
      console.log('Comment created successfully:', result.data);
      
      // Clear the input
      setNewComment('');
      
      // Reload comments with profiles to ensure we have the complete data
      await loadCommentsWithProfiles(postId);
      
      // Update posts state to reflect the change
      setPosts(prevPosts => prevPosts.map(post => 
        post.id === postId 
          ? { ...post, comments: [...(post.comments || []), result.data] }
          : post
      ));
    } else {
      console.error('Failed to create comment:', result.msg);
      alert('Failed to add comment: ' + (result.msg || 'Unknown error'));
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!user?.id) {
      console.log('No user ID available');
      return;
    }
    
    // Pass the user ID to removeComment
    const result = await removeComment(commentId, user.id);
    
    if (result.success) {
      console.log('Comment deleted successfully');
      
      // Reload comments with profiles to ensure we have the updated data
      if (currentModalPostId) {
        await loadCommentsWithProfiles(currentModalPostId);
      }
      
      // Update posts state to reflect the change
      setPosts(prevPosts => prevPosts.map(post => 
        post.id === currentModalPostId 
          ? { ...post, comments: post.comments.filter(comment => comment.id !== commentId) }
          : post
      ));
    } else {
      console.error('Failed to delete comment:', result.msg);
      alert('Failed to delete comment: ' + (result.msg || 'Unknown error'));
    }
  };

  const loadCommentsWithProfiles = async (postId) => {
    try {
      console.log('Loading comments with profiles for post:', postId);
      console.log('Current user ID:', user?.id);
      
      // Check if user is authenticated before making the request
      if (!user?.id) {
        console.warn('User not authenticated yet, using fallback cached comments');
        setNeedsCommentsRefresh(true); // Set flag to retry when user becomes available
        const post = posts.find(p => p.id === postId);
        const fallbackComments = Array.isArray(post?.comments) ? post.comments : [];
        console.log('No auth fallback comments count:', fallbackComments.length);
        
        // Add basic profile structure to fallback comments
        const commentsWithBasicProfile = fallbackComments.map(comment => ({
          ...comment,
          users: comment.users || { 
            id: comment.userId, 
            name: 'Unknown User', 
            image: null 
          }
        }));
        
        setModalComments(commentsWithBasicProfile);
        return;
      }
      
      const result = await fetchPostCommentsSimple(postId);
      
      if (result.success) {
        console.log('Comments loaded successfully:', result.data.length, 'comments');
        
        // Fix "Unknown User" entries for the current authenticated user
        const fixedComments = result.data.map(comment => {
          if (comment.users?.name === 'Unknown User' && comment.userId === user?.id) {
            console.log('Fixing Unknown User for current user:', user.id);
            return {
              ...comment,
              users: {
                id: user.id,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'Current User',
                image: user.user_metadata?.avatar_url || null
              }
            };
          }
          return comment;
        });
        
        fixedComments.forEach((comment, index) => {
          console.log(`Comment ${index}:`, {
            id: comment.id,
            text: comment.text,
            userId: comment.userId,
            users: comment.users,
            usersName: comment.users?.name,
            hasUsers: !!comment.users
          });
        });
        setModalComments(fixedComments);
      } else {
        console.error('Failed to load comments:', result.msg);
        console.warn('Using fallback cached comments without profile data');
        // Fallback to existing comments if fetch fails
        const post = posts.find(p => p.id === postId);
        const fallbackComments = Array.isArray(post?.comments) ? post.comments : [];
        console.log('Fallback comments count:', fallbackComments.length);
        
        // Add basic profile structure to fallback comments
        const commentsWithBasicProfile = fallbackComments.map(comment => ({
          ...comment,
          users: comment.users || { 
            id: comment.userId, 
            name: 'Unknown User', 
            image: null 
          }
        }));
        
        setModalComments(commentsWithBasicProfile);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      console.warn('Exception occurred, using fallback cached comments');
      // Fallback to existing comments if fetch fails
      const post = posts.find(p => p.id === postId);
      const fallbackComments = Array.isArray(post?.comments) ? post.comments : [];
      console.log('Exception fallback comments count:', fallbackComments.length);
      
      // Add basic profile structure to fallback comments
      const commentsWithBasicProfile = fallbackComments.map(comment => ({
        ...comment,
        users: comment.users || { 
          id: comment.userId, 
          name: 'Unknown User', 
          image: null 
        }
      }));
      
      setModalComments(commentsWithBasicProfile);
    }
  };

  // Remove the scroll to index effect since we're showing all user posts
  if (loading) {
    return (
      <ScreenWrapper bg="white">
        <Header title={userId ? "User Posts" : "Your Posts"} showBackButton={true} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </ScreenWrapper>
    );
  }
  
  if (!user) {
    return (
      <ScreenWrapper bg="white">
        <Header title="Posts" showBackButton={true} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Please log in to view posts</Text>
        </View>
      </ScreenWrapper>
    );
  }
  
  if (!posts.length) {
    return (
      <ScreenWrapper bg="white">
        <Header title={userId ? "User Posts" : "Your Posts"} showBackButton={true} />
        <View style={styles.emptyContainer}>
          <Icon name="image" size={hp(8)} color={theme.colors.textLight} />
          <Text style={styles.emptyText}>No posts yet</Text>
          <Text style={styles.emptySubtext}>{userId ? "This user hasn't shared any moments yet!" : "Start sharing your moments!"}</Text>
          {!userId && (
            <Pressable 
              style={styles.createPostButton}
              onPress={() => router.push('/main/newPost')}
            >
              <Text style={styles.createPostText}>Create Post</Text>
            </Pressable>
          )}
        </View>
      </ScreenWrapper>
    );
  }

  const handleShare = async (item) => {
    try {
      const url = typeof item.file === 'string' ? getSupabaseFileUrl(item.file)?.uri : (item.file?.uri || '');
      await Share.share({
        message: item.body + (url ? `\n${url}` : ''),
        url,
        title: 'Check out this post!'
      });
    } catch (error) {
      // Optionally handle error
    }
  };

  // Helper to detect if file is video
  const isVideoFile = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false;
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const lower = filePath.toLowerCase();
    return videoExts.some(ext => lower.endsWith(ext));
  };

  const renderPost = ({ item }) => {
    let mediaUrl = null;
    if (item.file) {
      if (typeof item.file === 'string') {
        const urlObj = getSupabaseFileUrl(item.file);
        mediaUrl = urlObj ? urlObj.uri : null;
      } else if (typeof item.file === 'object' && item.file.uri) {
        mediaUrl = item.file.uri;
      }
    }
    
    const likeCount = Array.isArray(item.postLikes) ? item.postLikes.length : 0;
    const commentCount = Array.isArray(item.comments) ? item.comments.length : 0;
    const isTargetPost = currentPost && String(item.id) === String(currentPost.id);
    const isLiked = likedPosts.has(item.id);
    
    return (
      <View style={[styles.postContainer, isTargetPost && styles.highlightedPost]}>
        {/* Header: Avatar, Username, Time */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.userProfileLink}
            onPress={() => {
              // Navigate to user profile if it's not the current user's profile we're already viewing
              const profileUserId = item.users?.id || item.userid;
              if (profileUserId && String(profileUserId) !== String(userId)) {
                router.push(`/main/userProfile?id=${profileUserId}`);
              }
            }}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: getProfileImageUrl(item.users?.image) }} 
              style={styles.avatar} 
              onError={(error) => {
                console.log('Avatar image failed to load:', error.nativeEvent.error);
                console.log('Image URI was:', getProfileImageUrl(item.users?.image));
              }}
              onLoad={() => {
                console.log('Avatar image loaded successfully for:', item.users?.name);
              }}
            />
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.users?.name || user?.name || 'You'}</Text>
              <Text style={styles.timeText}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
          {isTargetPost && (
            <View style={styles.targetBadge}>
              <Text style={styles.targetBadgeText}>Notification</Text>
            </View>
          )}
        </View>

        {/* Post Content */}
        {item.body && (
          <Text style={styles.postBody}>{item.body}</Text>
        )}

        {/* Post Media: Video or Image */}
        {mediaUrl && (
          <View style={styles.mediaContainer}>
            {isVideoFile(item.file) ? (
              <Video
                source={{ uri: mediaUrl }}
                style={styles.media}
                resizeMode="contain"
                useNativeControls
                shouldPlay={false}
                isLooping
              />
            ) : (
              <Image 
                source={{ uri: mediaUrl }} 
                style={styles.media} 
                resizeMode="cover" 
              />
            )}
          </View>
        )}

        {/* Actions row: Like, Comment, Share */}
        <View style={styles.actionsRow}>
          <View style={styles.actionGroup}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item.id)}
            >
              <Icon 
                name="heart" 
                size={hp(2.4)} 
                color={isLiked ? theme.colors.rose : theme.colors.textLight}
                fill={isLiked ? theme.colors.rose : 'none'}
              />
            </TouchableOpacity>
            <Text style={styles.actionText}>{likeCount} likes</Text>
          </View>
          
          <View style={styles.actionGroup}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={async () => {
                setCurrentModalPostId(item.id);
                setCommentsModalVisible(true);
                
                // Simple delay to allow modal to open and auth to settle
                setTimeout(async () => {
                  console.log('Loading comments for post:', item.id, 'Current user:', user?.id);
                  await loadCommentsWithProfiles(item.id);
                }, 300);
              }}
            >
              <Icon name="comment" size={hp(2.4)} color={theme.colors.textLight} />
            </TouchableOpacity>
            <Text style={styles.actionText}>{commentCount} comments</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <Icon name="share" size={hp(2.4)} color={theme.colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper bg="white">
      <Header 
        title={currentPost ? "Post Details" : (userId ? "User Posts" : "Your Posts")} 
        showBackButton={true} 
      />
      
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      
      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCommentsModalVisible(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity 
                onPress={() => setCommentsModalVisible(false)}
                style={styles.closeButton}
              >
                <Icon name="x" size={hp(2.5)} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={modalComments}
              keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
              style={styles.commentsContainer}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: comment }) => {
                // Debug log to see the actual comment data structure
                console.log('Rendering comment:', {
                  id: comment.id,
                  text: comment.text?.substring(0, 20) + '...',
                  userId: comment.userId,
                  users: comment.users,
                  usersName: comment.users?.name,
                  hasUsers: !!comment.users
                });
                
                // Check multiple possible user ID fields for better compatibility
                const commentUserId = comment.userId || comment.user?.id || comment.users?.id;
                const canDelete = commentUserId === user?.id;
                
                return (
                  <View style={styles.commentItem}>
                    <Image 
                      source={{ uri: getProfileImageUrl(comment.user?.image || comment.users?.image) }} 
                      style={styles.commentAvatar} 
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>
                          {comment.user?.name || comment.users?.name || 'User'}
                        </Text>
                        {canDelete && (
                          <TouchableOpacity 
                            onPress={() => handleDeleteComment(comment.id)}
                            style={styles.deleteCommentButton}
                          >
                            <Icon name="delete" size={hp(1.8)} color={theme.colors.rose} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.commentText}>{comment.text}</Text>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.noCommentsContainer}>
                  <Icon name="comment" size={hp(6)} color={theme.colors.textLight} />
                  <Text style={styles.noCommentsText}>No comments yet</Text>
                </View>
              )}
            />
            
            {/* Add Comment Section */}
            <View style={styles.addCommentContainer}>
              <Image 
                source={{ uri: getProfileImageUrl(user?.image) }} 
                style={styles.commentAvatar} 
              />
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                onPress={() => handleAddComment(currentModalPostId)}
                disabled={!newComment.trim()}
              >
                <Icon name="send" size={hp(2)} color={newComment.trim() ? theme.colors.primary : theme.colors.textLight} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: hp(10),
  },
  loadingText: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  emptyText: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: theme.colors.textDark,
    marginTop: hp(2),
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(1),
    textAlign: 'center',
  },
  createPostButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.5),
    borderRadius: theme.radius.md,
    marginTop: hp(3),
  },
  createPostText: {
    color: 'white',
    fontSize: hp(1.8),
    fontWeight: '600',
  },
  listContainer: {
    paddingVertical: hp(1),
  },
  separator: {
    height: hp(1),
    backgroundColor: theme.colors.gray + '20',
  },
  postContainer: {
    backgroundColor: 'white',
    marginHorizontal: wp(4),
    marginVertical: hp(0.5),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray + '30',
    overflow: 'hidden',
  },
  highlightedPost: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4),
    paddingBottom: hp(1),
  },
  userProfileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
      },
    }),
  },
  avatar: {
    width: hp(5),
    height: hp(5),
    borderRadius: hp(2.5),
    backgroundColor: theme.colors.gray + '20',
  },
  userInfo: {
    flex: 1,
    marginLeft: wp(3),
  },
  username: {
    fontSize: hp(1.8),
    fontWeight: '600',
    color: theme.colors.textDark,
  },
  timeText: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    marginTop: hp(0.2),
  },
  targetBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.5),
    borderRadius: theme.radius.sm,
  },
  targetBadgeText: {
    color: 'white',
    fontSize: hp(1.2),
    fontWeight: '600',
  },
  postBody: {
    fontSize: hp(1.7),
    color: theme.colors.textDark,
    lineHeight: hp(2.3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
  },
  mediaContainer: {
    marginTop: hp(1),
  },
  media: {
    width: '100%',
    height: hp(30),
    backgroundColor: theme.colors.gray + '10',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray + '20',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: wp(6),
  },
  actionButton: {
    padding: hp(0.5),
    marginRight: wp(1),
  },
  actionText: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(2),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: theme.radius.lg,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : wp(95),
    maxHeight: '90%',
    minHeight: Platform.OS === 'web' ? 400 : hp(60),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray + '20',
  },
  modalTitle: {
    fontSize: hp(2),
    fontWeight: '600',
    color: theme.colors.textDark,
  },
  closeButton: {
    padding: hp(0.5),
  },
  commentsContainer: {
    flex: 1,
    padding: wp(4),
    minHeight: hp(30),
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(1.5),
  },
  commentAvatar: {
    width: hp(4),
    height: hp(4),
    borderRadius: hp(2),
    backgroundColor: theme.colors.gray + '20',
    marginRight: wp(3),
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.2),
  },
  commentUser: {
    fontSize: hp(1.6),
    fontWeight: '600',
    color: theme.colors.textDark,
    flex: 1,
  },
  deleteCommentButton: {
    padding: hp(0.5),
    marginLeft: wp(2),
  },
  commentText: {
    fontSize: hp(1.5),
    color: theme.colors.textDark,
    lineHeight: hp(2),
    marginBottom: hp(0.3),
  },
  commentTime: {
    fontSize: hp(1.2),
    color: theme.colors.textLight,
  },
  noCommentsContainer: {
    alignItems: 'center',
    paddingVertical: hp(4),
  },
  noCommentsText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginTop: hp(1),
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: wp(4),
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray + '20',
    backgroundColor: 'white',
    minHeight: Platform.OS === 'web' ? 60 : hp(8),
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray + '30',
    borderRadius: hp(2),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    marginHorizontal: wp(2),
    maxHeight: Platform.OS === 'web' ? 100 : hp(8),
    minHeight: Platform.OS === 'web' ? 40 : hp(4),
    fontSize: hp(1.6),
    color: theme.colors.textDark,
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      resize: 'none',
    }),
  },
  sendButton: {
    padding: hp(1),
    borderRadius: hp(1.5),
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default PostDetail;