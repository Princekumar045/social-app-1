import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useFollow } from '../contexts/FollowContext';
import { followUser, isFollowing, unfollowUser } from '../services/userServices';

const FollowDebugger = ({ targetUser }) => {
  const { user: currentUser } = useAuth();
  const { getFollowData, handleFollowAction } = useFollow();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Ready to test');

  const updateDebugInfo = (info) => {
    setDebugInfo(prev => `${new Date().toLocaleTimeString()}: ${info}\n${prev}`);
  };

  const checkFollowStatus = async () => {
    if (!currentUser?.id || !targetUser?.id) {
      updateDebugInfo('❌ Missing user IDs');
      return;
    }

    try {
      updateDebugInfo('🔍 Checking follow status...');
      const result = await isFollowing(currentUser.id, targetUser.id);
      updateDebugInfo(`📋 Follow check result: ${JSON.stringify(result)}`);
      
      if (result.success) {
        setFollowing(result.following);
        updateDebugInfo(`✅ Following status: ${result.following}`);
      } else {
        updateDebugInfo(`❌ Check failed: ${result.msg}`);
      }
    } catch (error) {
      updateDebugInfo(`❌ Check error: ${error.message}`);
    }
  };

  const testFollow = async () => {
    if (!currentUser?.id || !targetUser?.id || loading) return;

    setLoading(true);
    const action = following ? 'unfollow' : 'follow';
    updateDebugInfo(`🔄 Starting ${action}...`);

    try {
      let result;
      if (following) {
        result = await unfollowUser(currentUser.id, targetUser.id);
        updateDebugInfo(`➖ Unfollow result: ${JSON.stringify(result)}`);
      } else {
        result = await followUser(currentUser.id, targetUser.id);
        updateDebugInfo(`➕ Follow result: ${JSON.stringify(result)}`);
      }

      if (result.success) {
        const newStatus = !following;
        setFollowing(newStatus);
        handleFollowAction(currentUser.id, targetUser.id, newStatus);
        updateDebugInfo(`✅ ${action} successful, new status: ${newStatus}`);
      } else {
        updateDebugInfo(`❌ ${action} failed: ${result.msg}`);
        Alert.alert('Error', result.msg);
      }
    } catch (error) {
      updateDebugInfo(`❌ ${action} exception: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getContextData = () => {
    const contextData = getFollowData(targetUser?.id);
    updateDebugInfo(`📊 Context data: ${JSON.stringify(contextData)}`);
  };

  if (!currentUser || !targetUser || currentUser.id === targetUser.id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Follow Debugger</Text>
        <Text style={styles.error}>Invalid users for testing</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Follow Debugger</Text>
      <Text style={styles.subtitle}>
        Testing: {currentUser.username ? `@${currentUser.username}` : currentUser.name} → {targetUser.username ? `@${targetUser.username}` : targetUser.name}
      </Text>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={checkFollowStatus}>
          <Text style={styles.buttonText}>Check Status</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, following ? styles.unfollowButton : styles.followButton]} 
          onPress={testFollow}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : following ? 'Unfollow' : 'Follow'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={getContextData}>
          <Text style={styles.buttonText}>Get Context</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>
        Status: {following ? 'Following' : 'Not Following'}
      </Text>

      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>Debug Log:</Text>
        <Text style={styles.debugText}>{debugInfo}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    color: theme.colors.textLight,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  button: {
    backgroundColor: theme.colors.gray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  followButton: {
    backgroundColor: theme.colors.primary,
  },
  unfollowButton: {
    backgroundColor: theme.colors.rose,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  debugContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    maxHeight: 200,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  error: {
    color: 'red',
    textAlign: 'center',
  },
});

export default FollowDebugger;
