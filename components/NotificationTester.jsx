import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { hp, wp } from '../helpers/common';
import { supabase } from '../lib/supabase';
import { createCommentNotification, createLikeNotification } from '../services/notificationService';

const NotificationTester = () => {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);

  const testNotificationTable = async () => {
    setTesting(true);
    console.log('🧪 Testing notification system...');
    
    try {
      // Test 1: Check if table exists
      console.log('1. Checking notifications table...');
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('❌ Notifications table error:', error.message);
        Alert.alert(
          'Database Setup Required', 
          `The notifications table doesn't exist yet.\n\n` +
          `To fix this:\n` +
          `1. Go to Supabase Dashboard\n` +
          `2. Click "SQL Editor"\n` +
          `3. Run the SQL from CREATE_NOTIFICATIONS_TABLE.md\n\n` +
          `Error: ${error.message}`,
          [
            { text: 'OK', style: 'default' }
          ]
        );
        setTesting(false);
        return;
      }
      
      console.log('✅ Notifications table exists');
      
      // Test 2: Create test notification
      console.log('2. Creating test notification...');
      const testNotification = {
        sender_id: user.id,
        receiver_id: user.id,
        title: 'Test notification',
        data: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        read: false
      };
      
      const { data: newNotif, error: createError } = await supabase
        .from('notifications')
        .insert(testNotification)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating notification:', createError.message);
        Alert.alert('Creation Error', `Failed to create notification: ${createError.message}`);
        setTesting(false);
        return;
      }
      
      console.log('✅ Test notification created:', newNotif.id);
      
      // Test 3: Fetch notifications
      console.log('3. Fetching notifications...');
      const { data: notifications, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        console.error('❌ Error fetching notifications:', fetchError.message);
      } else {
        console.log('✅ Found notifications:', notifications.length);
        const unread = notifications.filter(n => !n.read).length;
        console.log('📊 Unread count:', unread);
      }
      
      Alert.alert(
        'Test Complete!', 
        `✅ Notification system working!\n\n` +
        `• Table exists: Yes\n` +
        `• Can create: Yes\n` +
        `• Can fetch: Yes\n` +
        `• Total notifications: ${notifications?.length || 0}\n` +
        `• Unread: ${notifications?.filter(n => !n.read).length || 0}\n\n` +
        `Check your notification bell - it should show a badge!`
      );
      
      // Clean up test notification after 10 seconds
      setTimeout(async () => {
        await supabase.from('notifications').delete().eq('id', newNotif.id);
        console.log('🧹 Test notification cleaned up');
      }, 10000);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      Alert.alert('Test Failed', error.message);
    }
    
    setTesting(false);
  };

  const testLikeNotification = async () => {
    console.log('🧪 Testing like notification...');
    const result = await createLikeNotification(user.id, user.id, 'test-post-123');
    console.log('Like notification result:', result);
    Alert.alert('Like Test', result.success ? 'Like notification created!' : `Error: ${result.msg}`);
  };

  const testCommentNotification = async () => {
    console.log('🧪 Testing comment notification...');
    const result = await createCommentNotification(user.id, user.id, 'test-post-123', 'test-comment-456');
    console.log('Comment notification result:', result);
    Alert.alert('Comment Test', result.success ? 'Comment notification created!' : `Error: ${result.msg}`);
  };

  const checkNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      
      const unread = data?.filter(n => !n.read).length || 0;
      Alert.alert(
        'Notification Status',
        `Total: ${data?.length || 0}\nUnread: ${unread}\n\n${data?.slice(0, 3).map((n, i) => `${i+1}. ${n.title}`).join('\n') || 'No notifications'}`
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Please login to test notifications</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification System Tester</Text>
      <Text style={styles.subtitle}>User: {user.email}</Text>
      
      <Pressable 
        style={[styles.button, testing && styles.buttonDisabled]} 
        onPress={testNotificationTable}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Testing...' : '🧪 Test Full System'}
        </Text>
      </Pressable>
      
      <Pressable style={styles.button} onPress={testLikeNotification}>
        <Text style={styles.buttonText}>❤️ Test Like Notification</Text>
      </Pressable>
      
      <Pressable style={styles.button} onPress={testCommentNotification}>
        <Text style={styles.buttonText}>💬 Test Comment Notification</Text>
      </Pressable>
      
      <Pressable style={styles.button} onPress={checkNotifications}>
        <Text style={styles.buttonText}>📊 Check Notifications</Text>
      </Pressable>
      
      <Text style={styles.instructions}>
        1. Tap "Test Full System" first{'\n'}
        2. Check notification bell for badge{'\n'}
        3. Open console (F12) to see logs{'\n'}
        4. Test like/comment functions
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(4),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  title: {
    fontSize: hp(2.5),
    fontWeight: theme.fonts.bold,
    color: theme.colors.textDark,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.5),
    borderRadius: theme.radius.md,
    marginVertical: 8,
    minWidth: wp(70),
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
  },
  buttonText: {
    color: 'white',
    fontSize: hp(1.8),
    fontWeight: theme.fonts.medium,
    textAlign: 'center',
  },
  instructions: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: hp(2),
  },
});

export default NotificationTester;
