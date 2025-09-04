import { supabase } from '../lib/supabase';

// Check if username is available
export const checkUsernameAvailability = async (username) => {
  try {
    if (!username || username.length < 3) {
      return { success: false, msg: 'Username must be at least 3 characters long' };
    }
    
    // Call the database function to check availability
    const { data, error } = await supabase
      .rpc('check_username_availability', { username_to_check: username });
    
    if (error) {
      console.log('Username check error:', error);
      return { success: false, msg: error.message };
    }
    
    return { success: true, available: data };
  } catch (error) {
    console.log('Username check exception:', error);
    return { success: false, msg: error.message };
  }
};

// Validate username format on client side
export const validateUsername = (username) => {
  if (!username) {
    return "Username is required";
  }
  if (username.length < 3) {
    return "Username must be at least 3 characters long";
  }
  if (username.length > 20) {
    return "Username must be less than 20 characters";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Username can only contain letters, numbers, and underscores";
  }
  if (username.startsWith('_') || username.endsWith('_')) {
    return "Username cannot start or end with underscore";
  }
  return "";
};

// Generate username from name
export const generateUsernameFromName = (name) => {
  if (!name) return null;
  
  // Clean the name: remove special characters, spaces, convert to lowercase
  let username = name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  
  // Limit to 15 characters to leave room for numbers if needed
  if (username.length > 15) {
    username = username.substring(0, 15);
  }
  
  // Remove trailing underscore if created by substring
  username = username.replace(/_$/, '');
  
  return username;
};

// Generate unique username for a user
export const generateUniqueUsername = async (name, userId = null) => {
  try {
    const baseUsername = generateUsernameFromName(name);
    if (!baseUsername) return null;
    
    let username = baseUsername;
    let counter = 1;
    let isAvailable = false;
    
    // Keep trying until we find an available username
    while (!isAvailable && counter <= 999) {
      const availabilityResult = await checkUsernameAvailability(username);
      
      if (availabilityResult.success && availabilityResult.available) {
        // Double check by querying database directly to avoid conflicts
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .neq('id', userId || 'none'); // Exclude current user if updating
        
        if (!error && (!data || data.length === 0)) {
          isAvailable = true;
        } else {
          username = `${baseUsername}${counter}`;
          counter++;
        }
      } else {
        username = `${baseUsername}${counter}`;
        counter++;
      }
    }
    
    return isAvailable ? username : null;
  } catch (error) {
    console.error('Error generating unique username:', error);
    return null;
  }
};

// Update user with generated username
export const assignUsernameToUser = async (userId, name) => {
  try {
    if (!userId || !name) {
      return { success: false, msg: 'User ID and name are required' };
    }
    
    // Check if user already has a username
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      return { success: false, msg: 'Error fetching user data' };
    }
    
    if (existingUser && existingUser.username) {
      return { success: true, msg: 'User already has a username', username: existingUser.username };
    }
    
    // Generate unique username
    const username = await generateUniqueUsername(name, userId);
    if (!username) {
      return { success: false, msg: 'Could not generate a unique username' };
    }
    
    // Update user with new username
    const { error: updateError } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId);
    
    if (updateError) {
      return { success: false, msg: updateError.message };
    }
    
    return { success: true, msg: 'Username assigned successfully', username };
  } catch (error) {
    console.error('Error assigning username:', error);
    return { success: false, msg: error.message };
  }
};

// Assign usernames to all users without one
export const assignUsernamesToAllUsers = async () => {
  try {
    // Get all users without usernames
    const { data: usersWithoutUsernames, error: fetchError } = await supabase
      .from('users')
      .select('id, name')
      .or('username.is.null,username.eq.');
    
    if (fetchError) {
      return { success: false, msg: fetchError.message };
    }
    
    if (!usersWithoutUsernames || usersWithoutUsernames.length === 0) {
      return { success: true, msg: 'All users already have usernames', updated: 0 };
    }
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const user of usersWithoutUsernames) {
      const result = await assignUsernameToUser(user.id, user.name);
      if (result.success) {
        successCount++;
        results.push({ id: user.id, name: user.name, username: result.username, success: true });
      } else {
        failCount++;
        results.push({ id: user.id, name: user.name, error: result.msg, success: false });
      }
    }
    
    return {
      success: true,
      msg: `Processed ${usersWithoutUsernames.length} users. Success: ${successCount}, Failed: ${failCount}`,
      results,
      updated: successCount,
      failed: failCount
    };
  } catch (error) {
    console.error('Error assigning usernames to all users:', error);
    return { success: false, msg: error.message };
  }
};

// Get all users
export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    if (error) {
      return { success: false, msg: error.message };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, msg: error.message };
  }
};

// Search users by name, email, or username
export const searchUsers = async (query, currentUserId, limit = 20) => {
  try {
    if (!query.trim()) {
      return { success: true, data: [] };
    }

    // Search in users table including username search
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, username, image, bio, phoneNumber, address')
      .neq('id', currentUserId) // Exclude current user
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`)
      .limit(limit);

    if (usersError) {
      console.log('Users search failed:', usersError.message);
      return { success: false, msg: usersError.message };
    }

    return { success: true, data: usersData || [] };
  } catch (error) {
    console.log('Search users exception:', error.message);
    return { success: false, msg: error.message };
  }
};
// Follow a user with robust error handling
export const followUser = async (followerId, followingId) => {
  try {
    // Validation checks
    if (!followerId || !followingId) {
      return { success: false, msg: 'Invalid user IDs provided' };
    }
    
    if (followerId === followingId) {
      return { success: false, msg: 'Cannot follow yourself' };
    }
    
    // Check if already following first to prevent duplicate errors
    const checkResult = await isFollowing(followerId, followingId);
    if (checkResult.success && checkResult.following) {
      return { success: true, msg: 'Already following this user', alreadyFollowing: true };
    }
    
    // Simple insert operation
    const { data, error } = await supabase
      .from("follows")
      .insert([{ 
        follower_id: followerId, 
        following_id: followingId
      }])
      .select();
    
    if (error) {
      console.error('Follow error details:', error);
      
      // Handle different types of errors
      if (error.code === '23505') {
        // Duplicate key error - user already following
        return { success: true, msg: 'Already following this user', alreadyFollowing: true };
      } else if (error.code === '42P01') {
        // Table doesn't exist
        return { success: false, msg: 'Database table not found. Please contact support.' };
      } else if (error.code === '23514') {
        // Check constraint violation (self-follow)
        return { success: false, msg: 'Cannot follow yourself' };
      } else {
        return { success: false, msg: error?.message || 'Failed to follow user' };
      }
    }
    
    console.log('✅ Successfully followed user');
    return { success: true, data };
    
  } catch (error) {
    console.error('Follow exception:', error);
    return { success: false, msg: error.message || 'Network error occurred' };
  }
};

// Unfollow a user with improved error handling
export const unfollowUser = async (followerId, followingId) => {
  try {
    // Validation checks
    if (!followerId || !followingId) {
      return { success: false, msg: 'Invalid user IDs provided' };
    }
    
    if (followerId === followingId) {
      return { success: false, msg: 'Cannot unfollow yourself' };
    }
    
    // Check if actually following (but don't fail if not following)
    const checkResult = await isFollowing(followerId, followingId);
    if (checkResult.success && !checkResult.following) {
      return { success: true, msg: 'Not following this user', notFollowing: true };
    }
    
    const { data, error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .select();
    
    if (error) {
      console.error('Unfollow error:', error);
      return { success: false, msg: error?.message || 'Failed to unfollow user' };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Unfollow exception:', error);
    return { success: false, msg: error.message || 'Network error occurred' };
  }
};

// Check if following with improved caching
export const isFollowing = async (followerId, followingId) => {
  try {
    // Validation checks
    if (!followerId || !followingId) {
      return { success: false, msg: 'Invalid user IDs provided' };
    }
    
    if (followerId === followingId) {
      return { success: true, following: false }; // Can't follow yourself
    }
    
    const { data, error } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors

    if (error) {
      console.error('Error in isFollowing:', error);
      return { success: false, msg: error?.message };
    }
    
    return { success: true, following: !!data };
  } catch (error) {
    console.error('Exception in isFollowing:', error);
    return { success: false, msg: error.message };
  }
};
// Get the number of followers for a user
export const getFollowerCount = async (userId) => {
  try {
    if (!userId) {
      return { success: false, msg: 'User ID is required' };
    }
    
    console.log('🔢 Counting followers for user:', userId);
    
    // Use the same query logic as getFollowersList to ensure consistency
    const { data, error } = await supabase
      .from("follows")
      .select(`
        follower_id,
        follower:follower_id (
          id
        )
      `)
      .eq("following_id", userId);
      
    if (error) {
      console.error('❌ Error in getFollowerCount:', error);
      return { success: false, msg: error?.message };
    }
    
    // Filter out records where follower user doesn't exist (same as getFollowersList)
    const validFollowers = data.filter(item => item.follower && item.follower.id);
    const count = validFollowers.length;
    
    console.log('📊 Follower count calculation:', {
      totalRecords: data?.length || 0,
      validFollowers: count,
      userId
    });
    
    return { success: true, count };
  } catch (error) {
    console.error('❌ Exception in getFollowerCount:', error);
    return { success: false, msg: error.message };
  }
};

// Get the number of users this user is following
export const getFollowingCount = async (userId) => {
  try {
    if (!userId) {
      return { success: false, msg: 'User ID is required' };
    }
    
    console.log('🔢 Counting following for user:', userId);
    
    // Use the same query logic as getFollowingList to ensure consistency
    const { data, error } = await supabase
      .from("follows")
      .select(`
        following_id,
        following:following_id (
          id
        )
      `)
      .eq("follower_id", userId);
      
    if (error) {
      console.error('❌ Error in getFollowingCount:', error);
      return { success: false, msg: error?.message };
    }
    
    // Filter out records where following user doesn't exist (same as getFollowingList)
    const validFollowing = data.filter(item => item.following && item.following.id);
    const count = validFollowing.length;
    
    console.log('📊 Following count calculation:', {
      totalRecords: data?.length || 0,
      validFollowing: count,
      userId
    });
    
    return { success: true, count };
  } catch (error) {
    console.error('❌ Exception in getFollowingCount:', error);
    return { success: false, msg: error.message };
  }
};

// Get the list of users who follow this user (followers)
export const getFollowersList = async (userId) => {
  try {
    if (!userId) {
      return { success: false, msg: 'User ID is required' };
    }
    
    console.log('🔍 Fetching followers for user:', userId);
    
    const { data, error } = await supabase
      .from("follows")
      .select(`
        follower_id,
        created_at,
        follower:follower_id (
          id,
          name,
          image,
          bio,
          email
        )
      `)
      .eq("following_id", userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error in getFollowersList:', error);
      return { success: false, msg: error?.message };
    }
    
    console.log('📋 Raw followers data from DB:', data);
    
    // Transform the data to return user objects, filtering out null followers
    const followers = data
      .filter(item => item.follower && item.follower.id) // Filter out null followers
      .map(item => ({
        ...item.follower,
        followedAt: item.created_at
      }));
    
    console.log('📋 Transformed followers:', followers);
    
    return { success: true, data: followers || [] };
  } catch (error) {
    console.error('❌ Exception in getFollowersList:', error);
    return { success: false, msg: error.message };
  }
};

// Get the list of users this user is following
export const getFollowingList = async (userId) => {
  try {
    if (!userId) {
      return { success: false, msg: 'User ID is required' };
    }
    
    console.log('🔍 Fetching following for user:', userId);
    
    const { data, error } = await supabase
      .from("follows")
      .select(`
        following_id,
        created_at,
        following:following_id (
          id,
          name,
          image,
          bio,
          email
        )
      `)
      .eq("follower_id", userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error in getFollowingList:', error);
      return { success: false, msg: error?.message };
    }
    
    console.log('📋 Raw following data from DB:', data);
    
    // Transform the data to return user objects, filtering out null following
    const following = data
      .filter(item => item.following && item.following.id) // Filter out null following
      .map(item => ({
        ...item.following,
        followedAt: item.created_at
      }));
    
    console.log('📋 Transformed following:', following);
    
    return { success: true, data: following || [] };
  } catch (error) {
    console.error('❌ Exception in getFollowingList:', error);
    return { success: false, msg: error.message };
  }
};

export const getUserData = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select()
      .eq("id", userId)
      .single();
    if (error) {
      return { success: false, msg: error?.message };
    }
    return { success: true, data };
  } catch (error) {
    console.error("got error", error);
    return { success: false, msg: error.message };
  }
};

export const updateUser = async (userId, data) => {
  try {
    const { error } = await supabase
      .from("users")
      .update(data)
      .eq("id", userId);
    if (error) {
      return { success: false, msg: error?.message };
    }
    return { success: true, data };
  } catch (error) {
    console.error("got error", error);
    return { success: false, msg: error.message };
  }
};

// Get top users with most followers (celebrities)
export const getTopUsersByFollowers = async (limit = 3) => {
  try {
    console.log('🌟 Fetching top users with most followers, limit:', limit);
    
    // Get follower counts for all users
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        following:following_id (
          id,
          name,
          username,
          image,
          bio
        )
      `);
    
    if (error) {
      console.error('❌ Error fetching follows data:', error);
      return { success: false, msg: error.message };
    }

    // If no follows data, get some users anyway to show posts
    if (!data || data.length === 0) {
      console.log('🌟 No follows found, getting recent users instead');
      const { data: recentUsers, error: usersError } = await supabase
        .from('users')
        .select('id, name, username, image, bio')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        return { success: false, msg: usersError.message };
      }
      
      const usersWithFollowerCount = (recentUsers || []).map(user => ({
        ...user,
        followerCount: 0
      }));
      
      return { success: true, data: usersWithFollowerCount };
    }

    // Count followers for each user
    const followerCounts = {};
    const userDetails = {};
    
    data.forEach(follow => {
      if (follow.following && follow.following.id) {
        const userId = follow.following.id;
        followerCounts[userId] = (followerCounts[userId] || 0) + 1;
        userDetails[userId] = follow.following;
      }
    });

    // Convert to array and sort by follower count
    const sortedUsers = Object.entries(followerCounts)
      .map(([userId, count]) => ({
        ...userDetails[userId],
        followerCount: count
      }))
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, limit);

    console.log('🌟 Top users by followers:', sortedUsers);
    
    // If we don't have enough users with followers, fill with other users
    if (sortedUsers.length < limit) {
      const existingUserIds = sortedUsers.map(user => user.id);
      const { data: additionalUsers, error: additionalError } = await supabase
        .from('users')
        .select('id, name, username, image, bio')
        .not('id', 'in', `(${existingUserIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(limit - sortedUsers.length);
      
      if (!additionalError && additionalUsers) {
        const additionalUsersWithCount = additionalUsers.map(user => ({
          ...user,
          followerCount: 0
        }));
        sortedUsers.push(...additionalUsersWithCount);
      }
    }
    
    return { success: true, data: sortedUsers };
  } catch (error) {
    console.error('❌ Exception in getTopUsersByFollowers:', error);
    return { success: false, msg: error.message };
  }
};