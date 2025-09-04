import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  console.log('useRealtimeNotifications hook initialized with userId:', userId);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!userId) {
      console.log('No userId provided, skipping fetch');
      setLoading(false);
      return;
    }
    
    console.log('🔄 [useRealtimeNotifications] Fetching notifications for user:', userId);
    
    try {
      console.log('🔄 [useRealtimeNotifications] Starting fresh fetch...');
      
      // Get notifications first
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (notifError) {
        console.log('Error fetching notifications:', notifError);
        setLoading(false);
        return;
      }
      
      console.log('Found notifications:', notifications?.length || 0);
      
      if (!notifications || notifications.length === 0) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }
      
      // Get unique sender IDs
      const senderIds = [...new Set(notifications.map(n => n.sender_id).filter(Boolean))];
      console.log('Fetching user details for sender IDs:', senderIds);
      
      let profileMap = {};
      
      // Fetch real users from the users table
      console.log('🔍 Fetching real user data from users table...');
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', senderIds);
      
      if (!usersError && users && users.length > 0) {
        // Build profile map from real users in users table
        users.forEach(user => {
          const displayName = user.name || user.full_name || user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`;
          profileMap[user.id] = {
            id: user.id,
            name: displayName,
            username: user.username || null,
            avatar_url: user.avatar_url || user.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
            bio: user.bio || null,
            email: user.email || null
          };
        });
        console.log('✅ Built profile map from users table with', Object.keys(profileMap).length, 'real users');
      } else {
        console.log('❌ No users found in users table or error occurred:', usersError?.message);
      }
      
      // For any missing users, use simple fallback (no generated names)
      senderIds.forEach(senderId => {
        if (!profileMap[senderId]) {
          console.log(`⚠️ User not found in database: ${senderId.slice(0, 8)}`);
          profileMap[senderId] = {
            id: senderId,
            name: `User ${senderId.slice(0, 8)}`,
            username: null,
            avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderId}`,
            bio: null
          };
        }
      });
      
      // Attach profiles to notifications
      const notificationsWithProfiles = notifications.map(notification => {
        const profile = profileMap[notification.sender_id];
        
        if (profile) {
          return {
            ...notification,
            sender: profile
          };
        } else {
          // Final fallback - simple user display
          const fallbackName = `User ${notification.sender_id.slice(0, 8)}`;
          console.log(`⚠️ Using simple fallback for sender_id: ${notification.sender_id.slice(0, 8)} -> ${fallbackName}`);
          
          return {
            ...notification,
            sender: {
              id: notification.sender_id,
              name: fallbackName,
              username: null,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${notification.sender_id}`,
              bio: null
            }
          };
        }
      });
      
      console.log('🔄 [useRealtimeNotifications] Final notifications with profiles:', notificationsWithProfiles.length);
      
      // Additional logging for first few notifications
      if (notificationsWithProfiles.length > 0) {
        console.log('🔍 [useRealtimeNotifications] First notification sample:');
        console.log('  - Title:', notificationsWithProfiles[0].title);
        console.log('  - Sender ID:', notificationsWithProfiles[0].sender?.id?.slice(0, 8));
        console.log('  - Sender Name:', notificationsWithProfiles[0].sender?.name);
        console.log('  - Full Sender Object:', JSON.stringify(notificationsWithProfiles[0].sender, null, 2));
      }
      
      setNotifications(notificationsWithProfiles);
      const unread = notificationsWithProfiles.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.log('Error in fetchNotifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (!error) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.log('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('receiver_id', userId)
        .eq('read', false);

      if (!error) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.log('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    console.log('🎣 useRealtimeNotifications effect running with userId:', userId);
    
    if (!userId) {
      console.log('❌ No userId provided to notifications hook');
      return;
    }

    fetchNotifications();

    console.log('📡 Setting up real-time subscription for user:', userId);
    
    // Set up real-time subscription for notifications
    const notificationChannel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `receiver_id=eq.${userId}`
      }, async (payload) => {
        console.log('🔔 Real-time notification received:', payload.new);
        console.log('🔔 Real-time notification received:', payload.new);
        
        // Try to fetch the notification with sender info, but fallback to basic data
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', payload.new.id)
          .single();

        if (!error && data) {
          console.log('📥 Adding notification to state:', data);
          // Ensure we fetch sender info for real-time notifications too
          if (data.sender_id && !data.sender) {
            try {
              const { data: sender, error: senderError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.sender_id)
                .single();
                
              if (!senderError && sender) {
                data.sender = {
                  id: sender.id,
                  name: sender.name || sender.full_name || sender.email?.split('@')[0] || `User ${sender.id.slice(0, 8)}`,
                  username: sender.username || null,
                  avatar_url: sender.avatar_url || sender.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender.id}`,
                  bio: sender.bio || null,
                  email: sender.email || null
                };
              } else {
                // Fallback sender info
                data.sender = {
                  id: data.sender_id,
                  name: `User ${data.sender_id.slice(0, 8)}`,
                  username: null,
                  avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.sender_id}`,
                  bio: null
                };
              }
            } catch (senderFetchError) {
              console.log('Error fetching sender for real-time notification:', senderFetchError);
              // Fallback sender info
              data.sender = {
                id: data.sender_id,
                name: `User ${data.sender_id.slice(0, 8)}`,
                username: null,
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.sender_id}`,
                bio: null
              };
            }
          }
          setNotifications(prev => [data, ...prev]);
          setUnreadCount(prev => prev + 1);
        } else if (error) {
          console.log('⚠️ Could not fetch full notification, creating safe fallback');
          // Create safe fallback notification with proper sender structure
          const fallbackNotification = {
            ...payload.new,
            sender: {
              id: payload.new.sender_id,
              name: `User ${payload.new.sender_id?.slice(0, 8) || 'Unknown'}`,
              username: null,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${payload.new.sender_id || 'default'}`,
              bio: null
            }
          };
          setNotifications(prev => [fallbackNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `receiver_id=eq.${userId}`
      }, (payload) => {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === payload.new.id 
              ? { ...notification, ...payload.new }
              : notification
          )
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};