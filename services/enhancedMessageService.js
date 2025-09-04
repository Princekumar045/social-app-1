/**
 * Enhanced Message Service
 * Handles user details fetching and real-time message updates
 */
import { supabase } from '../lib/supabase';

// Enhanced function to get user conversations with proper user details
export const getUserConversationsWithDetails = async (userId) => {
  try {
    console.log('🔍 Fetching conversations for user:', userId);
    
    // First get conversations with correct column names
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id, 
        participant_1, 
        participant_2, 
        updated_at,
        created_at
      `)
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.log('❌ Error fetching conversations:', error.message);
      return [];
    }

    console.log(`📊 Found ${conversations?.length || 0} conversations`);

    // Enhanced: Get user details for each conversation participant
    const conversationsWithDetails = await Promise.all(
      conversations.map(async (conv) => {
        const otherUserId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;
        
        // Get other user's details with fallback
        const userDetails = await getUserDetails(otherUserId);
        
        // Get last message for this conversation
        const lastMessage = await getLastMessageForConversation(conv.id);
        
        return {
          ...conv,
          otherUser: userDetails,
          lastMessage: lastMessage,
          unreadCount: await getUnreadCount(conv.id, userId)
        };
      })
    );

    console.log('✅ Enhanced conversations with user details loaded');
    return conversationsWithDetails;

  } catch (error) {
    console.log('❌ Error in getUserConversationsWithDetails:', error.message);
    return [];
  }
};

// Enhanced function to get user details
export const getUserDetails = async (userId) => {
  try {
    // Get user details from users table
    let { data: user, error } = await supabase
      .from('users')
      .select('id, name, username, image, bio, email, last_seen')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.log(`⚠️ User ${userId} not found:`, error?.message);
      return {
        id: userId,
        name: 'Unknown User',
        image: null,
        bio: '',
        email: '',
        last_seen: null,
        isOnline: false
      };
    }

    console.log(`✅ User details found for ${userId}:`, user.username ? `@${user.username}` : user.name);
    
    // Calculate online status
    const isOnline = calculateOnlineStatus(user.last_seen);
    
    return {
      ...user,
      isOnline
    };

  } catch (error) {
    console.log(`❌ Error fetching user details for ${userId}:`, error.message);
    return {
      id: userId,
      name: 'Unknown User',
      image: null,
      bio: '',
      email: '',
      last_seen: null,
      isOnline: false
    };
  }
};

// Get last message for a conversation
export const getLastMessageForConversation = async (conversationId) => {
  try {
    const { data: message, error } = await supabase
      .from('messages')
      .select('id, content, created_at, sender_id, is_read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return message;
  } catch (error) {
    return null;
  }
};

// Get unread message count for a conversation
export const getUnreadCount = async (conversationId, userId) => {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', userId);

    if (error) {
      return 0;
    }

    return count || 0;
  } catch (error) {
    return 0;
  }
};

// Calculate online status based on last seen
export const calculateOnlineStatus = (lastSeen) => {
  if (!lastSeen) return false;
  
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMinutes = (now - lastSeenDate) / (1000 * 60);
  
  // Consider online if seen within last 5 minutes
  return diffMinutes < 5;
};

// Enhanced message sending with real-time updates
export const sendMessageWithRealtime = async (conversationId, senderId, content) => {
  try {
    console.log('📤 Sending message with real-time updates...');
    
    // Send the message
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          content: content.trim(),
          is_read: false
        }
      ])
      .select()
      .single();

    if (error) {
      console.log('❌ Error sending message:', error.message);
      return { success: false, error: error.message };
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Update sender's online status
    await updateUserOnlineStatus(senderId);

    console.log('✅ Message sent successfully with real-time updates');
    return { success: true, message: newMessage };

  } catch (error) {
    console.log('❌ Error in sendMessageWithRealtime:', error.message);
    return { success: false, error: error.message };
  }
};

// Update user's online status
export const updateUserOnlineStatus = async (userId) => {
  try {
    const now = new Date().toISOString();
    
    // Update in users table
    const { error } = await supabase
      .from('users')
      .update({ last_seen: now })
      .eq('id', userId);

    if (error) {
      console.log('⚠️ Could not update online status:', error.message);
    }
  } catch (error) {
    console.log('⚠️ Could not update online status:', error.message);
  }
};

// Enhanced message fetching with sender details
export const getMessagesWithSenderDetails = async (conversationId, limit = 50) => {
  try {
    console.log('🔍 Fetching messages with sender details for conversation:', conversationId);
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.log('❌ Error fetching messages:', error.message);
      return [];
    }

    // Enhanced: Add sender details to each message
    const messagesWithDetails = await Promise.all(
      messages.map(async (message) => {
        const senderDetails = await getUserDetails(message.sender_id);
        return {
          ...message,
          sender: senderDetails
        };
      })
    );

    console.log(`✅ Loaded ${messagesWithDetails.length} messages with sender details`);
    return messagesWithDetails;

  } catch (error) {
    console.log('❌ Error in getMessagesWithSenderDetails:', error.message);
    return [];
  }
};

// Mark messages as read with real-time update
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      console.log('❌ Error marking messages as read:', error.message);
      return false;
    }

    console.log('✅ Messages marked as read');
    return true;
  } catch (error) {
    console.log('❌ Error in markMessagesAsRead:', error.message);
    return false;
  }
};

// Set up real-time message subscription with enhanced features
export const subscribeToMessages = (conversationId, onNewMessage, onMessageUpdate) => {
  console.log('⚡ Setting up real-time message subscription for conversation:', conversationId);
  
  const subscription = supabase
    .channel(`messages-${conversationId}`)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, 
      async (payload) => {
        console.log('📨 New message received:', payload.new?.content);
        
        // Enhanced: Get sender details for the new message
        const senderDetails = await getUserDetails(payload.new.sender_id);
        const enhancedMessage = {
          ...payload.new,
          sender: senderDetails
        };
        
        if (onNewMessage) {
          onNewMessage(enhancedMessage);
        }
      }
    )
    .on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, 
      async (payload) => {
        console.log('📝 Message updated:', payload.new?.id);
        
        if (onMessageUpdate) {
          onMessageUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return subscription;
};

// Set up typing indicator functionality
export const sendTypingIndicator = async (conversationId, userId, isTyping) => {
  try {
    // Use Supabase's presence feature for typing indicators
    const channel = supabase.channel(`typing-${conversationId}`);
    
    if (isTyping) {
      await channel.track({
        user_id: userId,
        typing: true,
        timestamp: Date.now()
      });
    } else {
      await channel.untrack();
    }
    
    return channel;
  } catch (error) {
    console.log('❌ Error with typing indicator:', error.message);
    return null;
  }
};

// Subscribe to typing indicators
export const subscribeToTyping = (conversationId, onTypingUpdate) => {
  const channel = supabase.channel(`typing-${conversationId}`);
  
  channel
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const typingUsers = Object.values(presenceState)
        .flat()
        .filter(user => user.typing)
        .map(user => user.user_id);
      
      if (onTypingUpdate) {
        onTypingUpdate(typingUsers);
      }
    })
    .subscribe();
    
  return channel;
};
