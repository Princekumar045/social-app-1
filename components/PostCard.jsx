import { Video } from 'expo-av';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RenderHTML from 'react-native-render-html';
import Icon from '../assets/icons';
import ThreeDotsHorizontal from '../assets/icons/ThreeDotsHorizontal';
import { theme } from '../constants/theme';
import { useFollow } from '../contexts/FollowContext';
import { hp, stripHtmlTags, wp } from "../helpers/common";
import { supabase } from '../lib/supabase';
import { downloadFile, getSupabaseFileUrl } from '../services/imageServices';
import { createCommentNotification, createLikeNotification, removeLikeNotification } from '../services/notificationService';
import { createComment, createPostLike, removeComment, removePost, removePostLike } from '../services/postService';
import { fetchPostCommentsSimple } from '../services/postServiceSimple';
import { followUser, unfollowUser } from '../services/userServices';
import Avatar from './Avatar';
import CommentItem from './CommentItem';
import Loading from './Loading';
import ProfileImageModal from './ProfileImageModal';

const textStyles = {
  color: theme.colors.dark,
  fontSize: hp(1.75),
}
const tagsStyles = {
  div: textStyles,
  p: textStyles,
  ol: textStyles,
  h1: {
    color: theme.colors.dark,
  },
  h4: {
    color: theme.colors.dark,
  }
}
const PostCard = ({
  item,
  currentUser,
  router,
  hasShadow = true,
  showDelete = false,
  onDeletePost = () => {},
  onEdit=()=>{}
})=>{
  const { getFollowData, handleFollowAction, addFollowListener, refreshFollowStatus, isInitialized } = useFollow();
  
  // Follow button state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isCheckingInitialStatus, setIsCheckingInitialStatus] = useState(true);

  // Profile image modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

    // Check if current user is following post user with improved persistence
  useEffect(() => {
    async function checkFollowStatus() {
      if (!item?.users?.id || !currentUser?.id || item?.users?.id === currentUser?.id) {
        setFollowing(false);
        setIsCheckingInitialStatus(false);
        return;
      }

      // Wait for context to be initialized
      if (!isInitialized) {
        return; // Will retry when isInitialized becomes true
      }

      try {
        // First check context for cached data
        const followData = getFollowData(item.users.id);
        
        if (followData.following !== undefined && !followData.isLoading) {
          setFollowing(followData.following);
          setIsCheckingInitialStatus(false);
        } else {
          // Force refresh from database if not in context or loading
          const refreshedStatus = await refreshFollowStatus(item.users.id);
          if (refreshedStatus !== undefined) {
            setFollowing(refreshedStatus);
          }
          setIsCheckingInitialStatus(false);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
        setFollowing(false);
        setIsCheckingInitialStatus(false);
      }
    }
    
    checkFollowStatus();
  }, [item?.users?.id, currentUser?.id, isInitialized]);

  // Listen for real-time follow updates with improved cleanup
  useEffect(() => {
    if (!item?.users?.id || !isInitialized) return;
    
    const cleanup = addFollowListener((event) => {
      if (event.targetUserId === item.users.id) {
        setFollowing(event.newFollowStatus);
      }
    });

    return cleanup;
  }, [item?.users?.id, isInitialized]);

  const handleFollow = async () => {
    if (!currentUser?.id || !item?.users?.id || followLoading) {
      return; // Prevent action if missing data or already loading
    }
    
    // Prevent double-tap issues
    if (followLoading) return;
    
    setFollowLoading(true);
    
    // Store current state for potential revert
    const currentFollowingState = following;
    
    // Optimistically update UI immediately for better UX
    const newFollowStatus = !following;
    setFollowing(newFollowStatus);
    
    try {
      let result;
      
      // Call the appropriate API
      if (currentFollowingState) {
        result = await unfollowUser(currentUser.id, item.users.id);
      } else {
        result = await followUser(currentUser.id, item.users.id);
      }
      
      if (result.success) {
        // Update context for real-time sync across the app
        handleFollowAction(currentUser.id, item.users.id, newFollowStatus);
        
        // Optional: Show success feedback like Instagram
        console.log(`${newFollowStatus ? 'Following' : 'Unfollowed'} ${item?.users?.username ? `@${item.users.username}` : item?.users?.name}`);
      } else {
        // Revert optimistic update on failure
        setFollowing(currentFollowingState);
        Alert.alert('Error', result.msg || 'Follow action failed. Please try again.');
      }
    } catch (error) {
      // Revert optimistic update on error
      setFollowing(currentFollowingState);
      console.error('Error in handleFollow:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setFollowLoading(false);
    }
  };
  const shadowStyles ={
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  }

  // like show function 
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // comment functionality
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const commentInputRef = useRef(null);

  // Three-dot menu functionality
  const [showMenu, setShowMenu] = useState(false);

  useEffect( ()=>{
    console.log('PostCard: Setting initial data from item');
    console.log('PostCard: item.postLikes:', item?.postLikes);
    console.log('PostCard: item.comments:', item?.comments);
    setLikes(item?.postLikes || []);
    setComments(item?.comments || []);
  }, [item?.postLikes, item?.comments]);    

  const openPostDetails = () => {
    console.log('Three-dot menu clicked');
    console.log('Current user ID:', currentUser?.id);
    console.log('Post userid:', item?.userid);
    console.log('Post users.id:', item?.users?.id);
    console.log('Can edit:', currentUser?.id === item?.userid || currentUser?.id === item?.users?.id);
    
    // Only show menu if current user owns the post
    if (currentUser?.id === item?.userid || currentUser?.id === item?.users?.id) {
      setShowMenu(true);
    } else {
      console.log('User cannot edit this post');
    }
  }

  const closeMenu = () => {
    setShowMenu(false);
  }

  const handleEditPost = () => {
    console.log('Edit post clicked');
    console.log('Post ID:', item?.id);
    console.log('Current platform:', Platform.OS);
    closeMenu();
    
    // Navigate to edit post screen
    if (Platform.OS === 'web') {
      // For web, try using window.location or a more explicit navigation
      const editUrl = `/main/newPost?editPostId=${item?.id}`;
      console.log('Navigating to:', editUrl);
      router.push(editUrl);
    } else {
      router.push(`/main/newPost?editPostId=${item?.id}`);
    }
  }

  const handleDeletePost = () => {
    console.log('Delete post clicked');
    console.log('Current platform:', Platform.OS);
    closeMenu();
    
    // For web, use window.confirm instead of Alert for better compatibility
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to delete this post? This action cannot be undone.'
      );
      
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Post',
        'Are you sure you want to delete this post? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  };

  const performDelete = async () => {
    console.log('Confirmed delete for post ID:', item?.id);
    console.log('Platform:', Platform.OS);
    console.log('User ID:', currentUser?.id);
    console.log('Post userid:', item?.userid);
    
    try {
      const result = await removePost(item?.id);
      console.log('Delete result:', result);
      
      if (result.success) {
        console.log('Delete successful, calling onDeletePost callback');
        
        if (Platform.OS === 'web') {
          alert('Post deleted successfully');
        } else {
          Alert.alert('Success', 'Post deleted successfully');
        }
        
        // Trigger a refresh of the posts list
        if (onDeletePost) {
          console.log('Calling onDeletePost callback');
          onDeletePost(item);
        } else {
          console.log('No onDeletePost callback provided');
        }
      } else {
        console.error('Delete failed:', result.msg);
        const errorMsg = result.msg || 'Failed to delete post';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMsg);
        } else {
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('Delete post error:', error);
      const errorMsg = 'Failed to delete post. Please try again.';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  }

  const openCommentModal = async () => {
    console.log('PostCard: Opening comment modal for post:', item?.id);
    console.log('PostCard: Current user at modal open:', currentUser);
    console.log('PostCard: Current user ID:', currentUser?.id);
    console.log('PostCard: Current user email:', currentUser?.email);
    
    setShowComments(true);
    
    // First ensure the current user has a user record
    if (currentUser?.id) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();
          
        if (!user) {
          console.log('Creating user record for current user');
          await supabase
            .from('users')
            .upsert({
              id: currentUser.id,
              name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
              email: currentUser.email,
              image: currentUser.user_metadata?.avatar_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error('Profile check error:', error);
      }
    }
    
    // Always fetch latest comments when opening modal
    const result = await fetchPostCommentsSimple(item?.id);
    console.log('PostCard: Fetched comments result:', result);
    if (result.success) {
      console.log('PostCard: Setting comments from fetch:', result.data);
      
      // Fix "Unknown User" entries for the current authenticated user
      const fixedComments = result.data.map(comment => {
        console.log('PostCard: Checking comment:', {
          commentId: comment.id,
          commentUserId: comment.userId,
          commentUserName: comment.users?.name,
          currentUserId: currentUser?.id,
          isMatch: comment.userId === currentUser?.id,
          isUnknownUser: comment.users?.name === 'Unknown User'
        });
        
        if (comment.users?.name === 'Unknown User' && comment.userId === currentUser?.id) {
          console.log('PostCard: Fixing Unknown User for current user:', currentUser.id);
          console.log('PostCard: Current user full data:', currentUser);
          console.log('PostCard: Using current user profile data:', {
            name: currentUser.name,
            email: currentUser.email,
            image: currentUser.image
          });
          return {
            ...comment,
            users: {
              id: currentUser.id,
              name: currentUser.name || 'Rakesh Patel', // Use the actual name from currentUser profile
              image: currentUser.image || 'https://runiqhjczymxcfxukuoe.supabase.co/storage/v1/object/public/uploads/Profiles/1754194065920.jpg'
            }
          };
        }
        return comment;
      });
      
      setComments(fixedComments);
    } else {
      console.log('PostCard: Failed to fetch comments:', result.msg);
    }
  }

  const closeCommentModal = () => {
    setShowComments(false);
    setNewComment('');
  }

  const onComment = async () => {
    if (!newComment.trim()) return;

    setCommentLoading(true);
    const comment = {
      text: newComment.trim(),
      userId: currentUser?.id,
      postId: item?.id,
    };

    const result = await createComment(comment);
    setCommentLoading(false);

    if (result.success) {
      if(currentUser.id != item.userid){
        // send notification
        console.log('Attempting to create comment notification...');
        console.log('Current user ID:', currentUser.id);
        console.log('Post owner ID (item.userid):', item.userid);
        console.log('Post ID:', item.id);
        console.log('Comment ID:', result?.data?.id);
        
        if (!item.userid) {
          console.log('⚠️ Warning: item.userid is undefined, cannot send notification');
        } else {
          const notifResult = await createCommentNotification(currentUser.id, item.userid, item.id, result?.data?.id);
          console.log('Comment notification result:', notifResult);
        }
      }
      // Refetch all comments to ensure up-to-date list
      const fetchResult = await fetchPostCommentsSimple(item?.id);
      if (fetchResult.success) {
        setComments(fetchResult.data);
      }
      setNewComment('');
      commentInputRef.current?.blur();
    } else {
      Alert.alert('Comment', result.msg || 'Failed to add comment');
    }
  }

  const onDeleteComment = async (commentId) => {
    console.log('PostCard: Attempting to delete comment:', commentId);
    console.log('PostCard: Current user:', currentUser);
    
    // Check authentication status
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    console.log('PostCard: Auth user:', authUser);
    console.log('PostCard: Auth error:', authError);
    
    // Pass the current user ID to removeComment
    const userId = authUser?.id || currentUser?.id;
    console.log('PostCard: Using user ID for deletion:', userId);
    
    const result = await removeComment(commentId, userId);
    console.log('PostCard: Delete result:', result);
    
    if (result.success) {
      console.log('PostCard: Comment deleted successfully, refetching comments');
      // Refetch all comments to ensure up-to-date list
      const fetchResult = await fetchPostCommentsSimple(item?.id);
      if (fetchResult.success) {
        console.log('PostCard: Comments refetched successfully:', fetchResult.data);
        setComments(fetchResult.data);
      } else {
        console.log('PostCard: Failed to refetch comments:', fetchResult.msg);
      }
    } else {
      console.log('PostCard: Failed to delete comment:', result.msg);
      Alert.alert('Delete Comment', result.msg || 'Failed to delete comment');
    }
  }

  const onLike = async () => {
    if(liked){
      /// remove like 

      let updatedLikes = likes.filter(like => like.userId !== currentUser?.id);
      setLikes([...updatedLikes]);
      let removeRes = await removePostLike(item?.id, currentUser?.id); 
      console.log('removeRes:', removeRes);
      if(!removeRes.success) { 
        Alert.alert('Post', 'Something went wrong!');    
      } else {
        // Remove like notification
        await removeLikeNotification(currentUser?.id, item?.userid, item?.id);
      }
    }
    else{

      // create like 

      let data = {
        userId: currentUser?.id,
        postId: item?.id,
      }

      setLikes([...likes, data]); 
      let createRes = await createPostLike(data);
      console.log('createRes:', createRes);
      if(!createRes.success) {
        Alert.alert('Post', 'Something want wrong!');
        return;
      } else {
        // Send like notification
        if (!item?.userid) {
          console.log('⚠️ Warning: item.userid is undefined, cannot send notification');
        } else {
          const notifResult = await createLikeNotification(currentUser?.id, item?.userid, item?.id);
        }
      }
    }
  }

  const onShare = async () => {
    try {
      let message = stripHtmlTags(item?.body) || 'Check out this post!';
      
      if(item?.file){
        console.log('File to share:', item?.file);
        
        // Get the Supabase file URL
        const fileUrlObj = getSupabaseFileUrl(item?.file);
        console.log('File URL object:', fileUrlObj);
        
        if(fileUrlObj && fileUrlObj.uri) {
          setLoading(true);
          
          // For media files, we'll save to gallery and share the Supabase URL
          try {
            // Download and save to gallery
            let downloadedUrl = await downloadFile(fileUrlObj.uri);
            console.log('Downloaded URL:', downloadedUrl);
            
            if(downloadedUrl && downloadedUrl.uri) {
              // Save to media library
              const { status } = await MediaLibrary.requestPermissionsAsync();
              if (status === 'granted') {
                await MediaLibrary.createAssetAsync(downloadedUrl.uri);
                console.log('File saved to gallery');
              }
              
              // Share with both message and the original Supabase URL
              await Share.share({
                message: `${message}\n\nView media: ${fileUrlObj.uri}`,
              });
              
              // Show success message
              Alert.alert(
                'Shared!', 
                'Post shared! Media has been saved to your gallery.',
                [{ text: 'OK' }]
              );
            } else {
              // If download failed, just share the message
              await Share.share({ message: message });
            }
          } catch (error) {
            console.log('Download/save error:', error);
            // Fallback: share message with media URL
            await Share.share({
              message: `${message}\n\nView media: ${fileUrlObj.uri}`,
            });
          }
          
          setLoading(false);
        } else {
          console.log('Invalid file URL, sharing text only');
          await Share.share({ message: message });
        }
      } else {
        // No file, just share text
        await Share.share({ message: message });
      }
      
    } catch (error) {
      setLoading(false);
      console.log('Share error:', error);
      Alert.alert('Share failed', 'Unable to share this post');
    }
  }
      
  
  
  const createdAt = item?.created_at && moment(item.created_at).isValid() 
    ? moment(item.created_at).format('MMM D')
    : 'Now';

  // Smart detection for images vs videos
  const getMediaType = (filePath) => {
    if (!filePath) return { isImage: false, isVideo: false };
    
    const lowerPath = filePath.toLowerCase();
    
    // First check by file extension (more reliable)
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    
    const hasImageExt = imageExts.some(ext => lowerPath.endsWith(ext));
    const hasVideoExt = videoExts.some(ext => lowerPath.endsWith(ext));
    
    // If we have clear extension match, use it
    if (hasImageExt) return { isImage: true, isVideo: false };
    if (hasVideoExt) {
      // Treat all .mp4 in postVideos as videos (fix)
      if (lowerPath.includes('postvideos') && lowerPath.endsWith('.mp4')) {
        return { isImage: false, isVideo: true };
      }
      return { isImage: false, isVideo: true };
    }
    
    // Fallback to folder-based detection
    const hasImageFolder = lowerPath.includes('postimages');
    const hasVideoFolder = lowerPath.includes('postvideos');
    
    return { 
      isImage: hasImageFolder, 
      isVideo: hasVideoFolder && !hasImageExt // Don't treat as video if it has image extension
    };
  };

  const mediaType = getMediaType(item?.file);

  // Debug logging
  console.log('PostCard item:', {
    file: item?.file,
    fileUrl: item?.file ? getSupabaseFileUrl(item?.file) : null,
    mediaType,
    hasImage: mediaType.isImage,
    hasVideo: mediaType.isVideo
  });
  const liked = likes.filter(like => like.userId == currentUser?.id)[0]? true: false;
  // console.log('post item ' , item);
  return (
    <View style={[styles.container, hasShadow && shadowStyles]}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity 
            onPress={() => router.push(`/main/userProfile?id=${item?.users?.id}`)}
            onLongPress={() => setShowProfileModal(true)}
            delayLongPress={500}
          >
            <Avatar
              size={hp(4)}
              uri={item?.users?.image}
              rounded={theme.radius.md}
            />
          </TouchableOpacity>
          <View style={{gap:2}}>
            <TouchableOpacity 
              onPress={() => router.push(`/main/userProfile?id=${item?.users?.id}`)}
              onLongPress={() => router.push(`/main/userProfile?id=${item?.users?.id}`)}
              delayLongPress={500}
            >
              <Text style={styles.username}>
                {item?.users?.username ? `@${item.users.username}` : (item?.users?.name || 'Unknown User')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.postTime}>{createdAt}</Text>
          </View>
          {/* Follow button, only show if not current user */}
          {item?.users?.id && currentUser?.id && item.users.id !== currentUser.id && (
            <TouchableOpacity
              style={[
                styles.followButton,
                {
                  backgroundColor: following 
                    ? 'transparent' 
                    : theme.colors.primary,
                  borderWidth: following ? 1 : 0,
                  borderColor: following ? theme.colors.gray : 'transparent',
                  opacity: isCheckingInitialStatus ? 0.6 : 1
                }
              ]}
              onPress={handleFollow}
              disabled={followLoading || isCheckingInitialStatus}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.followButtonText,
                { 
                  color: following ? theme.colors.textDark : '#fff',
                  opacity: (followLoading || isCheckingInitialStatus) ? 0.6 : 1 
                }
              ]}>
                {isCheckingInitialStatus ? '...' : followLoading ? '•••' : following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Show three-dot menu only for post owner */}
        {(currentUser?.id === item?.userid || currentUser?.id === item?.users?.id) && (
          <TouchableOpacity onPress={openPostDetails}>
            <ThreeDotsHorizontal size={hp(3.4)} strokeWidth={3} color={theme.colors.text} />
          </TouchableOpacity>
        )}
      </View>


      {/* {
        showDelete && currentUser?.id == item?.userId && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={onEditPost(item)}>
              <Icon name="edit" size={hp(3.4)} strokeWidth={3} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDeletePost(item)}>
              <Icon name="trash" size={hp(3.4)} strokeWidth={3} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        )
      } */}

    {/* post body and media  */}

    <View style={styles.content}>
      <View style={styles.postBody}>
        {
          item?.body && (
            <RenderHTML
              contentWidth={wp(100)}
              source={{ html: item.body }}
              tagsStyles={tagsStyles}
            />
          )
        }
      </View>
      {/* Post image */}
      {
        item?.file && mediaType.isImage && (
          <Image
            source={getSupabaseFileUrl(item?.file)}
            transition={100}
            style={styles.postMedia}
            contentFit="cover"
          />
        )
      }
      {/* Post Video */}
      {
        item?.file && mediaType.isVideo && (
          <Video
            source={getSupabaseFileUrl(item?.file)}
            style={[styles.postMedia, {height: hp(30)}]}
            resizeMode="contain"
            isLooping
            useNativeControls
            shouldPlay={false}
            onError={(error) => {
              console.log('PostCard Video error:', error);
            }}
            onLoad={() => {
              console.log('PostCard Video loaded successfully');
            }}
          />
        )
      }
    </View>
    {/* Like , comment & share */}
    <View style={styles.footer}>
      <View style={styles.footerButton}>
        <TouchableOpacity onPress={onLike}>
          <Icon name="heart" size={24} fill={liked? theme.colors.rose: 'transparent'} color={liked? theme.colors.rose: theme.colors.textLight} />
        </TouchableOpacity>
        <Text style={styles.count}>
          {
            likes?.length
          }
        </Text>
      </View>
      <View style={styles.footerButton}>
        <TouchableOpacity onPress={openCommentModal}>
          <Icon name="comment" size={24} color={theme.colors.textLight} />
        </TouchableOpacity>
        <Text style={styles.count}>
          {
            comments?.length || 0
          }
        </Text>
      </View>
      <View style={styles.footerButton}>
      {
        loading?(
          <Loading size="small"/>
        ):( <TouchableOpacity onPress={onShare}>
          <Icon name="share" size={24} color={theme.colors.textLight} />
        </TouchableOpacity>
        )
      }
       
      </View>
    </View>

    {/* Comments Modal */}
    <Modal
      visible={showComments}
      animationType="slide"
      transparent={Platform.OS === 'web'}
      presentationStyle={Platform.OS === 'web' ? undefined : "pageSheet"}
      onRequestClose={closeCommentModal}
      supportedOrientations={['portrait', 'landscape']}
    >
      {Platform.OS === 'web' ? (
        <View style={styles.webModalOverlay}>
          <View style={styles.webModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={closeCommentModal}>
                <Icon name="x" size={hp(2.5)} color={theme.colors.textLight} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <CommentItem
                  item={item}
                  currentUser={currentUser}
                  onDelete={onDeleteComment}
                  router={router}
                />
              )}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
                </View>
              }
            />
            
            <View style={styles.commentInputContainer}>
              <Avatar
                size={hp(4)}
                uri={currentUser?.image}
                rounded={theme.radius.md}
              />
              <View style={styles.inputWrapper}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput}
                  placeholder="Write a comment..."
                  placeholderTextColor={theme.colors.textLight}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  onPress={onComment} 
                  style={[
                    styles.sendButton,
                    { opacity: newComment.trim() ? 1 : 0.5 }
                  ]}
                  disabled={!newComment.trim() || commentLoading}
                >
                  {commentLoading ? (
                    <Loading size="small" />
                  ) : (
                    <Icon name="send" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <TouchableOpacity onPress={closeCommentModal}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <CommentItem
                item={item}
                currentUser={currentUser}
                onDelete={onDeleteComment}
                router={router}
              />
            )}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
              </View>
            }
          />
          
          <View style={styles.commentInputContainer}>
            <Avatar
              size={hp(4)}
              uri={currentUser?.image}
              rounded={theme.radius.md}
            />
            <View style={styles.inputWrapper}>
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={theme.colors.textLight}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                onPress={onComment} 
                style={[
                  styles.sendButton,
                  { opacity: newComment.trim() ? 1 : 0.5 }
                ]}
                disabled={!newComment.trim() || commentLoading}
              >
                {commentLoading ? (
                  <Loading size="small" />
                ) : (
                  <Icon name="send" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>

    {/* Post Menu Modal */}
    <Modal
      visible={showMenu}
      animationType="fade"
      transparent={true}
      onRequestClose={closeMenu}
    >
      <TouchableOpacity 
        style={styles.menuOverlay} 
        activeOpacity={1} 
        onPress={closeMenu}
      >
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleEditPost}
            activeOpacity={0.7}
          >
            <Icon name="edit" size={hp(2.5)} color={theme.colors.textDark} />
            <Text style={styles.menuText}>Edit Post</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={handleDeletePost}
            activeOpacity={0.7}
          >
            <Icon name="delete" size={hp(2.5)} color={theme.colors.rose} />
            <Text style={[styles.menuText, { color: theme.colors.rose }]}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Profile Image Modal */}
    <ProfileImageModal
      visible={showProfileModal}
      user={item?.users}
      onClose={() => setShowProfileModal(false)}
      router={router}
    />
    </View>
  ) 
}


  export default PostCard;
 const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: wp(2.5),
    marginBottom: hp(2),
    borderRadius: theme.radius.xxl * 1.1,
    borderCurve: 'continuous',
    padding: wp(4),
    paddingVertical: hp(2),
    backgroundColor: 'white',
    borderWidth: 0.5,
    borderColor: theme.colors.gray,
    shadowColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  username: {
    fontSize: hp(1.8),
    color: theme.colors.textDark,
    fontWeight: theme.fonts.medium,
  },
  postTime: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
  },
  content: {
    gap: wp(2),
    marginBottom: hp(1),
  },
  postText: {
    fontSize: hp(1.6),
    color: theme.colors.text,
    lineHeight: hp(2.2),
  },
  postMedia: {
    height: hp(40),
    width: '100%',
    borderRadius: theme.radius.xl,
    borderCurve: 'continuous',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4),
  },
  footerButton: {
    marginLeft: wp(1),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(4.5),
  },
  count: {
    color: theme.colors.text,
    fontSize: hp(1.5),
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(2),
  },
  webModalContent: {
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
    borderBottomColor: theme.colors.gray,
    paddingTop: hp(6), // Account for status bar
  },
  modalTitle: {
    fontSize: hp(2.2),
    fontWeight: theme.fonts.bold,
    color: theme.colors.textDark,
  },
  closeButton: {
    fontSize: hp(1.8),
    color: theme.colors.primary,
    fontWeight: theme.fonts.semibold,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: wp(2),
  },
  commentsContainer: {
    flexGrow: 1,
    paddingBottom: wp(2),
  },
  emptyComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(10),
  },
  emptyText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: wp(4),
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray,
    backgroundColor: 'white',
    gap: wp(2),
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.gray,
    borderRadius: theme.radius.xl,
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    gap: wp(2),
  },
  commentInput: {
    flex: 1,
    fontSize: hp(1.6),
    color: theme.colors.textDark,
    maxHeight: Platform.OS === 'web' ? 100 : hp(10),
    minHeight: hp(4.5),
    textAlignVertical: 'center',
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      resize: 'none',
    }),
  },
  sendButton: {
    padding: wp(1),
  },
  followButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  followButtonText: {
    fontWeight: '600',
    fontSize: hp(1.5),
  },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: theme.radius.lg,
    paddingVertical: wp(2),
    minWidth: wp(40),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: wp(3),
    gap: wp(3),
  },
  menuText: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.medium,
    color: theme.colors.textDark,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.gray + '30',
    marginHorizontal: wp(4),
  },
});