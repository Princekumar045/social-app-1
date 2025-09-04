import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useFollow } from '../contexts/FollowContext';

const ProfileDebugger = ({ targetUserId, targetUserName, targetUserUsername }) => {
  const { user: currentUser } = useAuth();
  const { 
    followState, 
    refreshFollowCounts, 
    refreshFollowStatus,
    handleFollowAction,
    isInitialized 
  } = useFollow();

  const [debugInfo, setDebugInfo] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentUserData = followState[targetUserId] || {};

  const refreshData = async () => {
    if (!targetUserId || !isInitialized) return;
    
    setIsRefreshing(true);
    try {
      const counts = await refreshFollowCounts(targetUserId);
      const followStatus = await refreshFollowStatus(targetUserId);
      
      setDebugInfo({
        counts,
        followStatus,
        timestamp: new Date().toLocaleTimeString(),
        contextData: currentUserData
      });
    } catch (error) {
      console.error('Debug refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleFollow = async () => {
    if (!targetUserId || !currentUser?.id) return;
    
    try {
      const isCurrentlyFollowing = currentUserData.isFollowing;
      await handleFollowAction(targetUserId, !isCurrentlyFollowing);
      
      // Refresh after action
      setTimeout(refreshData, 1000);
    } catch (error) {
      console.error('Follow toggle error:', error);
    }
  };

  useEffect(() => {
    if (targetUserId && isInitialized) {
      refreshData();
    }
  }, [targetUserId, isInitialized]);

  if (!targetUserId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Profile Debugger</Text>
        <Text style={styles.error}>No target user ID provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Debug - {targetUserUsername ? `@${targetUserUsername}` : (targetUserName || targetUserId)}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Real-time Data:</Text>
        <Text>Follower Count: {currentUserData.followerCount || 0}</Text>
        <Text>Following Count: {currentUserData.followingCount || 0}</Text>
        <Text>Is Following: {currentUserData.isFollowing ? 'Yes' : 'No'}</Text>
        <Text>Last Updated: {debugInfo.timestamp || 'Never'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Info:</Text>
        <Text style={styles.debugText}>
          {JSON.stringify(debugInfo, null, 2)}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.refreshButton]} 
          onPress={refreshData}
          disabled={isRefreshing}
        >
          <Text style={styles.buttonText}>
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.followButton]} 
          onPress={toggleFollow}
        >
          <Text style={styles.buttonText}>
            {currentUserData.isFollowing ? 'Unfollow' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    margin: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  section: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666',
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#444',
  },
  error: {
    color: 'red',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
  },
  followButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ProfileDebugger;
