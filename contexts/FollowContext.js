import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getFollowerCount, getFollowingCount } from '../services/userServices';

const FollowContext = createContext({});

export const useFollow = () => {
  const context = useContext(FollowContext);
  if (!context) {
    throw new Error('useFollow must be used within a FollowProvider');
  }
  return context;
};

export const FollowProvider = ({ children }) => {
  // Track follow relationships: { userId: { following: boolean, followers: count, following: count } }
  const [followState, setFollowState] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize current user and set up real-time subscriptions
  useEffect(() => {
    const initializeFollowContext = async () => {
      try {
        // Get current user
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          console.log('No authenticated user for follow context');
          setIsInitialized(true);
          return;
        }

        setCurrentUserId(user.id);
        
        // Load initial follow data for current user
        await loadUserFollowData(user.id);
        
        // Set up real-time subscription
        setupFollowSubscription(user.id);
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing follow context:', error);
        setIsInitialized(true);
      }
    };

    initializeFollowContext();

    // Cleanup subscription on unmount
    return () => {
      if (window.followSubscription) {
        window.followSubscription.unsubscribe();
        window.followSubscription = null;
      }
    };
  }, []);

  // Load follow data for current user with better error handling
  const loadUserFollowData = async (userId) => {
    try {
      // Get all users the current user is following
      const { data: following, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followingError) {
        console.error('Error loading following data:', followingError);
        
        // If table doesn't exist, just initialize empty state
        if (followingError.code === '42P01') {
          console.log('⚠️ Follows table not found. Please set up the database.');
          setFollowState({});
          return;
        }
        return;
      }

      // Update state with following data
      const followingIds = following?.map(f => f.following_id) || [];
      const newState = {};
      
      followingIds.forEach(targetId => {
        newState[targetId] = {
          following: true,
          followerCount: 0, // Will be updated by real-time events
          followingCount: 0
        };
      });

      setFollowState(prev => ({
        ...prev,
        ...newState
      }));

    } catch (error) {
      console.error('Error in loadUserFollowData:', error);
    }
  };

  // Set up real-time subscription for follows table with error handling
  const setupFollowSubscription = (userId) => {
    try {
      // Remove existing subscription
      if (window.followSubscription) {
        window.followSubscription.unsubscribe();
      }

      // Create new subscription with error handling
      window.followSubscription = supabase
        .channel('follows_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'follows',
            filter: `follower_id=eq.${userId}` // Only changes where current user is the follower
          },
          (payload) => {
            console.log('Follow change detected:', payload);
            handleRealTimeFollowChange(payload, userId);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public', 
            table: 'follows',
            filter: `following_id=eq.${userId}` // Only changes where current user is being followed
          },
          (payload) => {
            console.log('Follower change detected:', payload);
            handleRealTimeFollowerChange(payload, userId);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Follow subscriptions active');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('⚠️ Follow subscription error - table may not exist');
          }
        });

    } catch (error) {
      console.error('Error setting up follow subscription:', error);
    }
  };
  // Handle real-time follow changes (when current user follows/unfollows someone)
  const handleRealTimeFollowChange = (payload, userId) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'INSERT' && newRecord) {
      // Current user started following someone
      updateFollowStatus(newRecord.following_id, true);
    } else if (eventType === 'DELETE' && oldRecord) {
      // Current user unfollowed someone  
      updateFollowStatus(oldRecord.following_id, false);
    }
  };

  // Handle real-time follower changes (when someone follows/unfollows current user)
  const handleRealTimeFollowerChange = (payload, userId) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Update follower count for current user
    if (eventType === 'INSERT' && newRecord) {
      // Someone followed current user
      const currentData = followState[userId] || {};
      updateFollowerCount(userId, (currentData.followerCount || 0) + 1);
    } else if (eventType === 'DELETE' && oldRecord) {
      // Someone unfollowed current user
      const currentData = followState[userId] || {};
      updateFollowerCount(userId, Math.max(0, (currentData.followerCount || 0) - 1));
    }
  };
  
  // Update follow status for a user
  const updateFollowStatus = useCallback((userId, isFollowing) => {
    setFollowState(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        following: isFollowing
      }
    }));
  }, []);

  // Update follower count for a user
  const updateFollowerCount = useCallback((userId, count) => {
    setFollowState(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        followerCount: count
      }
    }));
  }, []);

  // Update following count for a user
  const updateFollowingCount = useCallback((userId, count) => {
    setFollowState(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        followingCount: count
      }
    }));
  }, []);

  // Handle follow action with real-time updates
  const handleFollowAction = (currentUserId, targetUserId, newFollowStatus) => {
    if (!currentUserId || !targetUserId) {
      console.warn('Invalid user IDs provided to handleFollowAction');
      return;
    }
    
    // Update the follow status
    updateFollowStatus(targetUserId, newFollowStatus);
    
    // Update follower count for target user (more conservative approach)
    const currentTargetData = followState[targetUserId] || {};
    const currentCount = currentTargetData.followerCount || 0;
    
    // Only update count if we have a valid current count or if this is the first interaction
    let newCount;
    if (newFollowStatus) {
      newCount = currentCount + 1;
    } else {
      newCount = Math.max(0, currentCount - 1);
    }
    
    updateFollowerCount(targetUserId, newCount);

    // Broadcast follow change event to all listeners
    broadcastFollowChange({
      type: newFollowStatus ? 'follow' : 'unfollow',
      currentUserId,
      targetUserId,
      newFollowStatus,
      timestamp: new Date().toISOString()
    });
  };

  // Event listeners for follow changes
  const [followListeners, setFollowListeners] = useState([]);

  const addFollowListener = useCallback((listener) => {
    setFollowListeners(prev => [...prev, listener]);
    
    // Return cleanup function
    return () => {
      setFollowListeners(prev => prev.filter(l => l !== listener));
    };
  }, []); // No dependencies to prevent recreation

  const broadcastFollowChange = useCallback((event) => {
    followListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in follow listener:', error);
      }
    });
  }, [followListeners]);

  // Get follow data for a user with better defaults
  const getFollowData = (userId) => {
    if (!userId || !isInitialized) {
      return {
        following: false,
        followerCount: 0,
        followingCount: 0,
        isLoading: !isInitialized
      };
    }

    return followState[userId] || {
      following: false,
      followerCount: 0,
      followingCount: 0,
      isLoading: false
    };
  };

  // Force refresh follow status for a specific user
  const refreshFollowStatus = useCallback(async (targetUserId) => {
    if (!currentUserId || !targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error refreshing follow status:', error);
        return;
      }

      const isFollowing = !!data;
      updateFollowStatus(targetUserId, isFollowing);
      
      return isFollowing;
    } catch (error) {
      console.error('Error in refreshFollowStatus:', error);
      return false;
    }
  }, [currentUserId, updateFollowStatus]);

  // Force refresh follow counts for a specific user
  const refreshFollowCounts = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const [followerRes, followingRes] = await Promise.all([
        getFollowerCount(userId),
        getFollowingCount(userId)
      ]);

      if (followerRes.success && followingRes.success) {
        // Update the context with fresh counts
        setFollowState(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            followerCount: followerRes.count,
            followingCount: followingRes.count
          }
        }));

        console.log(`Refreshed counts for user ${userId}: ${followerRes.count} followers, ${followingRes.count} following`);
        
        return {
          followerCount: followerRes.count,
          followingCount: followingRes.count
        };
      }
    } catch (error) {
      console.error('Error refreshing follow counts:', error);
    }
    
    return null;
  }, []);

  // Initialize follow data for a user
  const initializeFollowData = (userId, data) => {
    setFollowState(prev => ({
      ...prev,
      [userId]: {
        following: data.following || false,
        followerCount: data.followerCount || 0,
        followingCount: data.followingCount || 0,
        ...prev[userId] // Keep any existing data
      }
    }));
  };

  const value = {
    followState,
    currentUserId,
    isInitialized,
    updateFollowStatus,
    updateFollowerCount,
    updateFollowingCount,
    handleFollowAction,
    addFollowListener,
    getFollowData,
    initializeFollowData,
    refreshFollowStatus,
    refreshFollowCounts,
    loadUserFollowData
  };

  return (
    <FollowContext.Provider value={value}>
      {children}
    </FollowContext.Provider>
  );
};
