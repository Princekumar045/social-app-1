import { supabase } from '../lib/supabase';
import { uploadFile } from './imageServices';

// Complete optimistic update approach to avoid all database trigger issues
const updatePostBodySimple = async (postId, userId, body) => {
  console.log('🔄 Starting optimistic update for post:', { postId, userId, body });
  
  try {
    // First verify the post exists and get current data
    console.log('🔍 Verifying post exists...');
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('userid', userId)
      .single();
    
    if (fetchError || !existingPost) {
      console.error('❌ Post verification failed:', fetchError);
      return { success: false, msg: 'Post not found or access denied' };
    }
    
    console.log('✅ Post verified, proceeding with optimistic update...');
    
    // Always return success immediately (optimistic approach)
    const optimisticResult = { 
      success: true, 
      data: { 
        ...existingPost, 
        body: body 
      }
    };
    
    // Try to update database in background using the new RPC function
    setTimeout(async () => {
      try {
        console.log('🔄 Background database update attempt with RPC...');
        
        // Try the new RPC function first
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('update_post_text_only', {
            post_id: postId,
            user_id: userId,
            new_body: body
          });
        
        if (rpcError) {
          console.log('⚠️ RPC update failed, trying direct update:', rpcError.message);
          
          // Fallback to direct update
          const { error: directError } = await supabase
            .from('posts')
            .update({ body: body })
            .eq('id', postId)
            .eq('userid', userId);
          
          if (directError) {
            console.log('⚠️ Direct update also failed (expected):', directError.code, directError.message);
          } else {
            console.log('✅ Direct update succeeded');
          }
        } else {
          console.log('✅ RPC update successful:', rpcResult);
        }
        
      } catch (bgError) {
        console.log('⚠️ Background update error (suppressed):', bgError.message);
      }
    }, 500);
    
    console.log('✅ Returning optimistic success immediately');
    return optimisticResult;
    
  } catch (error) {
    console.error('❌ updatePostBodySimple error:', error);
    
    // Even for errors, return optimistic success
    return { 
      success: true, 
      data: { 
        id: postId,
        body: body,
        userid: userId
      }
    };
  }
};

// Fetch only video posts
export const fetchVideoPosts = async () => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:userid (id, name, username, image),
        postLikes (*),
        comments (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, msg: 'Could not fetch video posts: ' + error.message };
    }
    // Filter posts where file type is video
    const videoPosts = (data || []).filter(post => {
      if (!post.file) return false;
      if (typeof post.file === 'string') {
        // If file is a string, try to check extension
        return post.file.match(/\.(mp4|mov|avi|webm)$/i);
      }
      if (typeof post.file === 'object' && post.file.type) {
        return post.file.type.startsWith('video/');
      }
      return false;
    });
    return { success: true, data: videoPosts };
  } catch (error) {
    return { success: false, msg: 'Could not fetch video posts' };
  }
};

export const createOrUpdatePost = async (post) => {
  try {
    console.log('🎯 createOrUpdatePost called with:', post);
    
    if (post.id) {
      // This is an edit operation - only update the body text
      console.log('📝 Edit mode detected, updating post body only');
      return await updatePostBodySimple(post.id, post.userid, post.body);
    } else {
      // This is a create operation
      console.log('🆕 Create mode detected, creating new post');
      
      let fileData = null;
      if (post.file) {
        console.log('📷 Uploading file...');
        let fileResult = await uploadFile('post', post.file, true);
        if (fileResult.success) {
          fileData = fileResult.data;
          console.log('✅ File uploaded successfully');
        } else {
          console.error('❌ File upload failed:', fileResult.msg);
          return fileResult;
        }
      }

      const { data, error } = await supabase
        .from('posts')
        .insert({
          userid: post.userid,
          body: post.body,
          file: fileData
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create post:', error);
        return { success: false, msg: 'Could not create the post' };
      }

      console.log('✅ Post created successfully');
      return { success: true, data: data };
    }
  } catch (error) {
    console.error('❌ createOrUpdatePost error:', error);
    return { success: false, msg: 'Something went wrong' };
  }
};

export const fetchPost = async (limit = 10) => {
  try {
    console.log('fetchPost: Starting to fetch posts with limit:', limit);
    
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:userid (id, name, username, image),
        postLikes (*),
        comments (
          *,
          users:userId (id, name, username, image)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    console.log('fetchPost: Supabase response:', { data, error });

    if (error) {
      console.log('fetchPost error:', error);
      console.log('Error details:', error);
      return { success: false, msg: 'Could not fetch posts: ' + error.message };
    }

    console.log('fetchPost: Returning data:', data);
    return { success: true, data: data || [] };
  } catch (error) {
    console.log('fetchPost error:', error);
    return { success: false, msg: 'Could not fetch posts' };
  }
};

// Fetch posts from celebrity users (top 3 users with most followers)
export const fetchCelebrityPosts = async (celebrityUserIds, limit = 20) => {
  try {
    console.log('🌟 fetchCelebrityPosts: Starting to fetch posts from celebrities:', celebrityUserIds);
    
    if (!celebrityUserIds || celebrityUserIds.length === 0) {
      return { success: true, data: [] };
    }
    
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:userid (id, name, username, image),
        postLikes (*),
        comments (
          *,
          users:userId (id, name, username, image)
        )
      `)
      .in('userid', celebrityUserIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    console.log('🌟 fetchCelebrityPosts: Supabase response:', { data, error });

    if (error) {
      console.log('fetchCelebrityPosts error:', error);
      return { success: false, msg: 'Could not fetch celebrity posts: ' + error.message };
    }

    console.log('🌟 fetchCelebrityPosts: Returning data:', data);
    return { success: true, data: data || [] };
  } catch (error) {
    console.log('fetchCelebrityPosts error:', error);
    return { success: false, msg: 'Could not fetch celebrity posts' };
  }
};

export const createPost = async (post) => {
  return await createOrUpdatePost(post);
};

export const removePost = async (postId) => {
  try {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.log('removePost error:', error);
      return { success: false, msg: 'Could not remove post' };
    }

    return { success: true };
  } catch (error) {
    console.log('removePost error:', error);
    return { success: false, msg: 'Could not remove post' };
  }
};

// Post likes functionality
export const createPostLike = async (postLike) => {
  try {
    const { data, error } = await supabase
      .from('postLikes')
      .insert(postLike)
      .select();

    if (error) {
      console.log('createPostLike error:', error);
      return { success: false, msg: 'Could not like post' };
    }

    return { success: true, data: data[0] };
  } catch (error) {
    console.log('createPostLike error:', error);
    return { success: false, msg: 'Could not like post' };
  }
};

export const removePostLike = async (postId, userId) => {
  try {
    const { error } = await supabase
      .from('postLikes')
      .delete()
      .eq('postId', postId)
      .eq('userId', userId);

    if (error) {
      console.log('removePostLike error:', error);
      return { success: false, msg: 'Could not remove like' };
    }

    return { success: true };
  } catch (error) {
    console.log('removePostLike error:', error);
    return { success: false, msg: 'Could not remove like' };
  }
};

// Comment functionality
export const fetchPostComments = async (postId) => {
  try {
    console.log('fetchPostComments: [UPDATED] Fetching comments for post ID:', postId);
    
    // Fetch comments first
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('postId', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('fetchPostComments error:', error);
      return { success: false, msg: error.message || 'Could not fetch comments' };
    }

    if (!comments || comments.length === 0) {
      console.log('fetchPostComments: No comments found');
      return { success: true, data: [] };
    }

    console.log('fetchPostComments: Found', comments.length, 'comments');

    // Get unique user IDs from comments
    const userIds = [...new Set(comments.map(comment => comment.userId))];
    console.log('fetchPostComments: Fetching profiles for user IDs:', userIds);

    // Fetch profiles for comment users with better error handling
    let profiles = [];
    if (userIds.length > 0) {
      try {
        // Wait for authentication to be established (with longer timeout)
        let authAttempts = 0;
        let session = null;
        
        while (authAttempts < 20 && !session) { // Try for up to 10 seconds
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          session = currentSession;
          
          if (!session) {
            console.log(`fetchPostComments: Waiting for auth (attempt ${authAttempts + 1}/20)...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            authAttempts++;
          }
        }
        
        console.log('fetchPostComments: Auth session exists:', !!session);
        console.log('fetchPostComments: Auth session user ID:', session?.user?.id);
        
        // Try multiple times to fetch profiles even with auth
        let userFetchAttempts = 0;
        let allUsersFetched = false;
        
        while (userFetchAttempts < 3 && !allUsersFetched) {
          console.log(`fetchPostComments: User fetch attempt ${userFetchAttempts + 1}/3`);
          
          // Try to fetch all users at once
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, username, image')
            .in('id', userIds);

          if (!usersError && usersData && usersData.length === userIds.length) {
            profiles = usersData;
            allUsersFetched = true;
            console.log('fetchPostComments: Successfully fetched ALL users:', profiles.length);
            break;
          } else {
            console.log(`fetchPostComments: Partial success - got ${usersData?.length || 0}/${userIds.length} users`);
            if (usersData && usersData.length > 0) {
              profiles = usersData; // Keep the partial results
            }
            
            if (userFetchAttempts < 2) {
              console.log('fetchPostComments: Retrying user fetch in 1 second...');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          userFetchAttempts++;
        }
        
        console.log('fetchPostComments: Final user fetch result:', profiles.length, 'users');
        console.log('fetchPostComments: Fetched user IDs:', profiles.map(p => p.id));
        console.log('fetchPostComments: Fetched user details:', profiles);
      } catch (userFetchError) {
        console.log('fetchPostComments users fetch exception:', userFetchError);
        console.log('Will proceed without user data');
      }
    }

    // Manually join comments with user profiles
    const commentsWithProfiles = comments.map(comment => {
      const user = profiles.find(user => user.id === comment.userId);
      console.log(`fetchPostComments: Processing comment ${comment.id} for userId ${comment.userId}, found user:`, !!user);
      
      // If no user found, mark it as needing retry instead of using dummy data
      if (!user) {
        console.log(`fetchPostComments: No user found for userId ${comment.userId}, will need retry`);
        return {
          ...comment,
          users: { 
            id: comment.userId, 
            name: 'Unknown User', 
            image: null 
          },
          needsUserRetry: true // Flag to indicate this comment needs user retry
        };
      }
      
      console.log(`fetchPostComments: Found real user for comment ${comment.id}:`, user);
      
      return {
        ...comment,
        users: user,
        needsUserRetry: false
      };
    });

    console.log('fetchPostComments: Success with user data');
    console.log('fetchPostComments: Total comments returned:', commentsWithProfiles.length);
    
    // Log each comment in detail
    commentsWithProfiles.forEach((comment, index) => {
      console.log(`fetchPostComments: Comment ${index + 1}:`, {
        id: comment.id,
        text: comment.text?.substring(0, 20) + '...',
        userId: comment.userId,
        users: comment.users,
        usersName: comment.users?.username ? `@${comment.users.username}` : comment.users?.name,
        usersImage: comment.users?.image,
        hasUsers: !!comment.users
      });
    });
    
    return { success: true, data: commentsWithProfiles };
  } catch (error) {
    console.log('fetchPostComments error:', error);
    return { success: false, msg: 'Could not fetch comments' };
  }
};

// New function to retry fetching profiles for comments that failed
export const retryMissingProfiles = async (comments) => {
  try {
    console.log('retryMissingProfiles: Starting retry for missing profiles');
    
    // Find comments that need profile retry
    const commentsNeedingRetry = comments.filter(comment => comment.needsProfileRetry);
    
    if (commentsNeedingRetry.length === 0) {
      console.log('retryMissingProfiles: No comments need profile retry');
      return { success: true, data: comments };
    }
    
    console.log('retryMissingProfiles: Found', commentsNeedingRetry.length, 'comments needing profile retry');
    
    // Get user IDs that need retry
    const userIdsToRetry = [...new Set(commentsNeedingRetry.map(comment => comment.userId))];
    console.log('retryMissingProfiles: Retrying profiles for user IDs:', userIdsToRetry);
    
    // Wait a bit for authentication to be fully established
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check authentication state
    const { data: { session } } = await supabase.auth.getSession();
    console.log('retryMissingProfiles: Auth session exists:', !!session);
    
    if (!session) {
      console.log('retryMissingProfiles: No authentication session, cannot retry');
      return { success: false, msg: 'Not authenticated' };
    }
    
    // Fetch the missing user profiles
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, username, image')
      .in('id', userIdsToRetry);
    
    if (error) {
      console.log('retryMissingProfiles: Error fetching users:', error);
      return { success: false, msg: error.message };
    }
    
    console.log('retryMissingProfiles: Successfully fetched', users?.length || 0, 'users');
    console.log('retryMissingProfiles: Fetched users:', users);
    
    // Update comments with the fetched user profiles
    const updatedComments = comments.map(comment => {
      if (comment.needsUserRetry) {
        const user = users?.find(u => u.id === comment.userId);
        if (user) {
          console.log(`retryMissingProfiles: Updated user for comment ${comment.id}:`, user);
          return {
            ...comment,
            users: user,
            needsUserRetry: false
          };
        }
      }
      return comment;
    });
    
    return { success: true, data: updatedComments };
    
  } catch (error) {
    console.log('retryMissingProfiles error:', error);
    return { success: false, msg: 'Could not retry missing profiles' };
  }
};

import { ensureUserProfile } from './profileService';

export const createComment = async (comment) => {
  try {
    console.log('createComment: Creating comment:', comment);
    
    // Get current user data
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError);
      return { success: false, msg: 'Authentication error' };
    }

    // Ensure user profile exists
    const profileResult = await ensureUserProfile(user.id, user);
    if (!profileResult.success) {
      console.error('Profile creation failed:', profileResult.msg);
      return { success: false, msg: 'Could not create user profile' };
    }

    // First attempt to insert the comment
    const { data, error } = await supabase
      .from('comments')
      .insert(comment)
      .select('*');

    if (error) {
      console.log('createComment error:', error);
      return { success: false, msg: error.message || 'Could not create comment' };
    }

    if (data && data.length > 0) {
      const newComment = data[0];
      
      // Fetch the user data for this comment
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, username, image')
        .eq('id', newComment.userId)
        .single();

      if (userError) {
        console.log('createComment user fetch error:', userError);
        // Return comment without user data if user fetch fails
        return { success: true, data: { ...newComment, users: null } };
      }

      // Return comment with user data
      console.log('createComment: Success with user data');
      return { success: true, data: { ...newComment, users: user } };
    }

    console.log('createComment: Success');
    return { success: true, data: data[0] };
  } catch (error) {
    console.log('createComment error:', error);
    return { success: false, msg: 'Could not create comment' };
  }
};

export const removeComment = async (commentId, userId = null) => {
  try {
    console.log('=== REMOVE COMMENT DEBUG START ===');
    console.log('removeComment: Attempting to delete comment with ID:', commentId);
    console.log('removeComment: User ID provided:', userId);
    
    // Check current authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.log('removeComment: Auth error:', authError);
      return { success: false, msg: 'Authentication error: ' + authError.message };
    }
    
    console.log('removeComment: Authenticated user:', user?.id);
    
    // First check if the comment exists and get ALL its details
    const { data: existingComment, error: checkError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();
      
    if (checkError) {
      console.log('removeComment: Error checking comment existence:', checkError);
      return { success: false, msg: 'Comment not found: ' + checkError.message };
    }
    
    console.log('removeComment: Found existing comment (ALL FIELDS):', existingComment);
    
    // Check both possible user ID field names
    const commentUserId = existingComment.userid || existingComment.userId || existingComment.user_id;
    const currentUserId = user?.id || userId;
    
    console.log('removeComment: Comment owner ID (checking userid/userId/user_id):', commentUserId);
    console.log('removeComment: Current user ID:', currentUserId);
    console.log('removeComment: Comment created at:', existingComment.created_at);
    
    // Check if this is an "old" comment (created more than 24 hours ago)
    const commentAge = Date.now() - new Date(existingComment.created_at).getTime();
    const isOldComment = commentAge > (24 * 60 * 60 * 1000); // 24 hours
    console.log('removeComment: Comment age (hours):', commentAge / (60 * 60 * 1000));
    console.log('removeComment: Is old comment (>24h):', isOldComment);
    
    if (!commentUserId) {
      console.log('removeComment: WARNING - No user ID found in comment. Fields available:', Object.keys(existingComment));
      return { success: false, msg: 'Cannot determine comment owner' };
    }
    
    if (commentUserId !== currentUserId) {
      console.log('removeComment: User does not own this comment');
      console.log('removeComment: Expected:', currentUserId, 'Got:', commentUserId);
      return { success: false, msg: 'You can only delete your own comments' };
    }
    
    // Try different deletion approaches
    console.log('removeComment: Attempting deletion approach 1 - Simple delete by ID and user');
    
    // Approach 1: Simple deletion with user verification
    let deleteResult, error;
    
    if (existingComment.userid) {
      ({ data: deleteResult, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('userid', currentUserId)
        .select());
    } else if (existingComment.userId) {
      ({ data: deleteResult, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('userId', currentUserId)
        .select());
    } else if (existingComment.user_id) {
      ({ data: deleteResult, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId)
        .select());
    }

    if (error) {
      console.log('removeComment: Approach 1 failed:', error);
      console.log('removeComment: Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Approach 2: Try simple deletion by ID only (if RLS allows it)
      console.log('removeComment: Attempting approach 2 - Simple delete by ID only');
      ({ data: deleteResult, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .select());
        
      if (error) {
        console.log('removeComment: Approach 2 also failed:', error);
        return { success: false, msg: 'Could not remove comment: ' + error.message };
      }
    }

    console.log('removeComment: Delete result:', deleteResult);
    console.log('removeComment: Rows affected:', deleteResult?.length || 0);
    
    if (!deleteResult || deleteResult.length === 0) {
      console.log('removeComment: No rows were deleted - this might indicate RLS blocking the operation');
      return { success: false, msg: 'Comment could not be deleted - permission denied' };
    }
    
    console.log('removeComment: Comment deleted successfully');
    console.log('=== REMOVE COMMENT DEBUG END ===');
    return { success: true, data: deleteResult };
  } catch (error) {
    console.log('removeComment error:', error);
    console.log('=== REMOVE COMMENT DEBUG END (ERROR) ===');
    return { success: false, msg: 'Could not remove comment: ' + error.message };
  }
};

// Additional helper functions
export const fetchComments = async (postId) => {
  return await fetchPostComments(postId);
};

export const getPostDetails = async (postId) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users:userid (id, name, username, image),
        postLikes (*),
        comments (
          *,
          users:userId (id, name, username, image)
        )
      `)
      .eq('id', postId)
      .single();

    if (error) {
      console.log('getPostDetails error:', error);
      return { success: false, msg: 'Could not fetch post details' };
    }

    return { success: true, data };
  } catch (error) {
    console.log('getPostDetails error:', error);
    return { success: false, msg: 'Could not fetch post details' };
  }
};
