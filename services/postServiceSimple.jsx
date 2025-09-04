// Simplified fetchPostComments function that works reliably
import { supabase } from '../lib/supabase';

export const fetchPostCommentsSimple = async (postId) => {
  try {
    console.log('fetchPostCommentsSimple: Fetching comments for post ID:', postId);
    
    // Fetch comments with profiles in a single query
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        users:userId (id, name, username, image)
      `)
      .eq('postId', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('fetchPostCommentsSimple error:', error);
      return { success: false, msg: error.message || 'Could not fetch comments' };
    }

    if (!comments || comments.length === 0) {
      console.log('fetchPostCommentsSimple: No comments found');
      return { success: true, data: [] };
    }

    console.log('fetchPostCommentsSimple: Found', comments.length, 'comments');

    // Fetch user data for all comments
    const userIds = [...new Set(comments.map(c => c.userId))];
    console.log('fetchPostCommentsSimple: Fetching users for user IDs:', userIds);
    
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, username, image')
      .in('id', userIds);

    if (userError) {
      console.log('fetchPostCommentsSimple user fetch error:', userError);
    }

    console.log('fetchPostCommentsSimple: Found users:', users);

    // Create a map of users for quick lookup
    const userMap = {};
    if (users) {
      users.forEach(user => {
        userMap[user.id] = user;
      });
    }

    // Map comments to include user data
    // Get current user once for all comments
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    const commentsWithProfiles = comments.map(comment => {
      // Users will be in comment.users after the join
      const user = comment.users;
      
      if (user) {
        console.log('fetchPostCommentsSimple: Using user for:', comment.userId, user.username ? `@${user.username}` : user.name);
        return {
          ...comment,
          users: user
        };
      } else if (currentUser && comment.userId === currentUser.id) {
        // If it's the current user's comment but no user found, use their data
        console.log('fetchPostCommentsSimple: Using current user data for:', comment.userId);
        return {
          ...comment,
          users: {
            id: currentUser.id,
            name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
            image: currentUser.user_metadata?.avatar_url
          }
        };
      } else {
        console.log('fetchPostCommentsSimple: No user for:', comment.userId);
        return {
          ...comment,
          users: { 
            id: comment.userId, 
            name: 'Unknown User', 
            image: null 
          }
        };
      }
    });

    console.log('fetchPostCommentsSimple: Success with profile data');
    console.log('fetchPostCommentsSimple: Total comments returned:', commentsWithProfiles.length);
    
    return { success: true, data: commentsWithProfiles };
  } catch (error) {
    console.log('fetchPostCommentsSimple error:', error);
    return { success: false, msg: 'Could not fetch comments' };
  }
};
