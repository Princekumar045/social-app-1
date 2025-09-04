import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFollow } from '../contexts/FollowContext';

/**
 * Hook to ensure follow data is loaded and refreshed on the home page
 * This handles the case where users reload the page or navigate back to home
 */
export const useFollowDataRefresh = () => {
  const { isInitialized, loadUserFollowData, currentUserId } = useFollow();
  const { user } = useAuth();

  useEffect(() => {
    const refreshFollowData = async () => {
      // Only refresh if context is initialized and we have a user
      if (isInitialized && user?.id && currentUserId !== user.id) {
        console.log('Refreshing follow data for user:', user.id);
        await loadUserFollowData(user.id);
      }
    };

    // Refresh data when component mounts or user changes
    refreshFollowData();
  }, [isInitialized, user?.id, currentUserId]);

  return {
    isInitialized,
    currentUserId
  };
};
