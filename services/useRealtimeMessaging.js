import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeMessaging = (userId) => {
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const soundRef = useRef(null);

  // Load notification sound
  useEffect(() => {
    loadNotificationSound();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadNotificationSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' }, // Default notification sound
        { shouldPlay: false }
      );
      soundRef.current = sound;
    } catch (error) {
      console.log('Could not load notification sound:', error);
    }
  };

  const playNotificationSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  };

  // Fetch initial data
  const fetchConversations = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get conversations with message counts
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          participant1_id,
          participant2_id,
          updated_at,
          last_message,
          created_at
        `)
        .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (convError) {
        console.log('Error fetching conversations:', convError);
        setLoading(false);
        return;
      }

      if (!conversations || conversations.length === 0) {
        setConversations([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // Get other participant IDs
      const participantIds = [];
      conversations.forEach(conv => {
        const otherId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
        if (!participantIds.includes(otherId)) {
          participantIds.push(otherId);
        }
      });

      // Get participant user data
      let profiles = [];
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, username, image, bio')
          .in('id', participantIds);
        profiles = usersData || [];
      } catch (e) {
        console.log('Error fetching user profiles:', e);
        profiles = [];
      }

      // Get unread message counts for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const { data: unreadMessages } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', userId);

          const otherParticipantId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
          const otherParticipant = profiles.find(p => p.id === otherParticipantId) || {
            id: otherParticipantId,
            name: 'Unknown User',
            image: null,
            bio: null
          };

          return {
            ...conv,
            otherParticipant,
            unread_count: unreadMessages?.length || 0,
            is_online: Math.random() > 0.5, // Mock online status for now
            last_seen: new Date(Date.now() - Math.random() * 3600000).toISOString()
          };
        })
      );

      setConversations(conversationsWithUnread);
      
      // Calculate total unread count
      const totalUnread = conversationsWithUnread.reduce((sum, conv) => sum + conv.unread_count, 0);
      setUnreadCount(totalUnread);
      
      setLoading(false);
    } catch (error) {
      console.log('Error in fetchConversations:', error);
      setLoading(false);
    }
  };

  // Handle new message notification
  const handleNewMessage = (payload) => {
    const newMessage = payload.new;
    
    // Don't notify for our own messages
    if (newMessage.sender_id === userId) return;

    // Play notification sound
    playNotificationSound();

    // Create Instagram-style notification
    const notification = {
      id: `msg_${newMessage.id}`,
      type: 'message',
      title: 'New Message',
      body: newMessage.content,
      data: {
        conversationId: newMessage.conversation_id,
        senderId: newMessage.sender_id
      },
      timestamp: new Date().toISOString()
    };

    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep only 10 recent notifications

    // Update conversation list
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === newMessage.conversation_id) {
          return {
            ...conv,
            last_message: newMessage.content,
            updated_at: newMessage.created_at,
            unread_count: (conv.unread_count || 0) + 1
          };
        }
        return conv;
      });
      
      // Sort by updated_at
      return updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    });

    // Update total unread count
    setUnreadCount(prev => prev + 1);
  };

  // Handle conversation updates
  const handleConversationUpdate = (payload) => {
    fetchConversations(); // Refresh conversations when they're updated
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    fetchConversations();

    // Subscribe to new messages
    const messageSubscription = supabase
      .channel('new_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        handleNewMessage
      )
      .subscribe();

    // Subscribe to conversation updates
    const conversationSubscription = supabase
      .channel('conversation_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations'
        },
        handleConversationUpdate
      )
      .subscribe();

    // Subscribe to message read status updates
    const readStatusSubscription = supabase
      .channel('message_read_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversations.map(c => c.id).join(',')})`
        },
        () => {
          // Refresh unread counts when messages are marked as read
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      messageSubscription.unsubscribe();
      conversationSubscription.unsubscribe();
      readStatusSubscription.unsubscribe();
    };
  }, [userId]);

  // Mark conversation as read
  const markConversationAsRead = async (conversationId) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId);

      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unread_count: 0 }
            : conv
        )
      );

      // Update total unread count
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        setUnreadCount(prev => Math.max(0, prev - conversation.unread_count));
      }
    } catch (error) {
      console.log('Error marking conversation as read:', error);
    }
  };

  // Clear notification
  const clearNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return {
    conversations,
    unreadCount,
    notifications,
    loading,
    fetchConversations,
    markConversationAsRead,
    clearNotification,
    clearAllNotifications,
    playNotificationSound
  };
};
