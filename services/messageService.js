import { supabase } from "../lib/supabase";

/**
 * Get detailed user profile
 */
export const getUserProfile = async (userId) => {
  try {
    console.log('Fetching user profile for ID:', userId);
    
    // Validate userId first
    if (!userId || userId === 'undefined' || userId === 'null' || userId === null) {
      console.log('❌ Invalid userId provided:', userId);
      return { 
        success: false, 
        msg: 'Invalid user ID provided',
        data: {
          id: userId || 'unknown',
          name: 'Unknown User',
          username: null,
          image: null,
          bio: null,
          email: null,
          phoneNumber: null
        }
      };
    }

    console.log('🔍 Skipping profiles table (does not exist), querying users table directly...');
    
    // Query users table directly since profiles doesn't exist
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, username, image, bio, email, phoneNumber, address, created_at')
      .eq('id', userId);

    if (!userError && userData && userData.length > 0) {
      console.log('✅ User found in users table:', userData[0]);
      return { success: true, data: userData[0] };
    }

    console.log('❌ User not found in users table. Error:', userError?.message);
    
    // For debugging, let's check what users exist
    console.log('🔍 Checking available users in database...');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, name')
      .limit(5);
    
    if (!allUsersError && allUsers) {
      console.log('Available users:', allUsers.map(u => `${u.name} (${u.id})`).join(', '));
    } else {
      console.log('Could not fetch available users:', allUsersError?.message);
    }
    
    // Return a default structure for unknown users
    return { 
      success: false, 
      msg: userError?.message || 'User not found in users table',
      data: {
        id: userId,
        name: 'Unknown User',
        username: null,
        image: null,
        bio: null,
        email: null,
        phoneNumber: null
      }
    };

  } catch (error) {
    console.log('❌ Exception in getUserProfile:', error);
    return { 
      success: false, 
      msg: error.message,
      data: {
        id: userId || 'unknown',
        name: 'Unknown User',
        username: null,
        image: null,
        bio: null,
        email: null,
        phoneNumber: null
      }
    };
  }
};

/**
 * Get conversation details and extract other participant ID
 */
export const getConversationDetails = async (conversationId, currentUserId) => {
  try {
    console.log('Getting conversation details for:', conversationId);
    
    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2, created_at, updated_at')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      console.log('Error fetching conversation details:', error?.message);
      return { success: false, msg: error?.message || 'Conversation not found' };
    }

    // Determine the other participant
    const otherUserId = conversation.participant_1 === currentUserId 
      ? conversation.participant_2 
      : conversation.participant_1;

    console.log('Found conversation with other user:', otherUserId);

    return { 
      success: true, 
      data: {
        ...conversation,
        otherUserId
      }
    };

  } catch (error) {
    console.log('Exception in getConversationDetails:', error);
    return { success: false, msg: error.message };
  }
};

/**
 * Get or create a conversation between two users
 */
export const getOrCreateConversation = async (userId1, userId2) => {
  try {
    console.log('Creating conversation between:', userId1, 'and', userId2);
    
    // Try the simplified RPC function first
    const { data, error } = await supabase.rpc('get_or_create_conversation_simple', {
      user1_id: userId1,
      user2_id: userId2
    });

    if (!error && data) {
      console.log('Conversation created/found with RPC:', data);
      return { success: true, data };
    }

    console.log('RPC function failed, using direct method:', error?.message);
    
    // Direct database approach - more reliable
    return await createConversationDirect(userId1, userId2);
    
  } catch (error) {
    console.log('Exception in getOrCreateConversation:', error);
    return await createConversationDirect(userId1, userId2);
  }
};

/**
 * Direct method to create conversation without RPC
 */
const createConversationDirect = async (userId1, userId2) => {
  try {
    console.log('Using direct method for conversation creation');
    
    // Ensure consistent ordering of participants
    const participant1 = userId1 < userId2 ? userId1 : userId2;
    const participant2 = userId1 < userId2 ? userId2 : userId1;

    console.log('Ordered participants:', participant1, participant2);

    // Check if conversation already exists
    const { data: existingConv, error: findError } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1', participant1)
      .eq('participant_2', participant2)
      .maybeSingle();

    if (findError) {
      console.log('Error checking existing conversation:', findError);
      // If table doesn't exist, return a helpful error
      if (findError.message.includes('relation "conversations" does not exist')) {
        return { 
          success: false, 
          msg: 'Database tables not set up. Please run the SQL setup script in Supabase.' 
        };
      }
      return { success: false, msg: findError.message };
    }

    if (existingConv?.id) {
      console.log('Found existing conversation:', existingConv.id);
      return { success: true, data: existingConv.id };
    }

    // Create new conversation
    console.log('Creating new conversation...');
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: participant1,
        participant_2: participant2
      })
      .select('id')
      .single();

    if (createError) {
      console.log('Error creating conversation:', createError);
      return { success: false, msg: createError.message };
    }

    console.log('Created new conversation:', newConv.id);
    return { success: true, data: newConv.id };
    
  } catch (error) {
    console.log('Exception in createConversationDirect:', error);
    return { success: false, msg: error.message };
  }
};

/**
 * Get all conversations for a user
 */
export const getUserConversations = async (userId) => {
  try {
    // First, try the full query with foreign key relationships
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        participant_1,
        participant_2,
        updated_at,
        last_message,
        last_message_at,
        participant_1_profile:profiles!conversations_participant_1_fkey(id, name, image, bio, email, phoneNumber),
        participant_2_profile:profiles!conversations_participant_2_fkey(id, name, image, bio, email, phoneNumber)
      `)
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      // Process data to get the other participant's info
      const processedData = data?.map(conversation => {
        const otherParticipant = conversation.participant_1 === userId 
          ? conversation.participant_2_profile 
          : conversation.participant_1_profile;
        
        return {
          ...conversation,
          otherParticipant
        };
      });

      return { success: true, data: processedData };
    }

    // If foreign key query fails, use fallback method
    console.log('Foreign key query failed, using fallback:', error?.message);
    return await getUserConversationsFallback(userId);
    
  } catch (error) {
    console.log('Exception in getUserConversations:', error);
    return await getUserConversationsFallback(userId);
  }
};

/**
 * Fallback method to get conversations without foreign key relationships
 */
const getUserConversationsFallback = async (userId) => {
  try {
    // Get basic conversation data
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2, updated_at')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (convError) {
      console.log('Error fetching conversations fallback:', convError);
      return { success: false, msg: convError.message };
    }

    if (!conversations || conversations.length === 0) {
      return { success: true, data: [] };
    }

    // Get participant IDs
    const participantIds = [];
    conversations.forEach(conv => {
      const otherId = conv.participant_1 === userId ? conv.participant_2 : conv.participant_1;
      if (!participantIds.includes(otherId)) {
        participantIds.push(otherId);
      }
    });

    // Get user profiles from users table only
    let profiles = [];
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, image, bio, email, phoneNumber')
        .in('id', participantIds);
      
      if (!usersError) {
        profiles = usersData || [];
      } else {
        console.log('Could not fetch user profiles from users table:', usersError.message);
      }
    } catch (e) {
      console.log('Error fetching user profiles:', e.message);
    }

    // Combine conversation data with profiles
    const processedData = conversations.map(conversation => {
      const otherUserId = conversation.participant_1 === userId 
        ? conversation.participant_2 
        : conversation.participant_1;
      
      const otherParticipant = profiles.find(p => p.id === otherUserId) || {
        id: otherUserId,
        name: 'Unknown User',
        image: null
      };
      
      return {
        ...conversation,
        otherParticipant
      };
    });

    return { success: true, data: processedData };
    
  } catch (error) {
    console.log('Exception in getUserConversationsFallback:', error);
    return { success: false, msg: error.message };
  }
};

/**
 * Get messages for a conversation
 */
export const getConversationMessages = async (conversationId, limit = 50) => {
  try {
    // First try with foreign key relationship to profiles
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        is_read,
        created_at,
        sender_profile:profiles!messages_sender_id_fkey(id, name, image)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (!error && data) {
      console.log('Messages fetched with profiles successfully');
      return { success: true, data };
    }

    console.log('Foreign key query failed, using fallback method:', error?.message);
    
    // Fallback: Get messages without foreign key relationship
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, media_url, media_type, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (msgError) {
      console.log('Error fetching messages fallback:', msgError);
      return { success: false, msg: msgError.message };
    }

    if (!messages || messages.length === 0) {
      return { success: true, data: [] };
    }

    // Get sender profiles separately
    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    let profiles = [];

    // Get sender profiles from users table only
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, image')
        .in('id', senderIds);
      
      if (!usersError) {
        profiles = usersData || [];
      } else {
        console.log('Could not fetch sender profiles from users table:', usersError.message);
      }
    } catch (e) {
      console.log('Error fetching sender profiles:', e.message);
    }

    // Combine messages with profiles
    const messagesWithProfiles = messages.map(message => {
      const senderProfile = profiles.find(p => p.id === message.sender_id) || {
        id: message.sender_id,
        name: 'Unknown User',
        image: null
      };

      return {
        ...message,
        sender_profile: senderProfile
      };
    });

    console.log(`Messages fetched with fallback method: ${messagesWithProfiles.length} messages`);
    return { success: true, data: messagesWithProfiles };

  } catch (error) {
    console.log('Exception in getConversationMessages:', error);
    return { success: false, msg: error.message };
  }
};

/**
 * Send a message
 */
export const sendMessage = async (conversationId, senderId, content, mediaUrl = null, mediaType = null) => {
  try {
    console.log('📤 Sending message to database:', { 
      conversationId, 
      senderId, 
      content: content.trim(),
      mediaUrl,
      mediaType,
      timestamp: new Date().toISOString()
    });
    // First try with foreign key relationship
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content?.trim() || '',
        media_url: mediaUrl,
        media_type: mediaType
      })
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        media_url,
        media_type,
        is_read,
        created_at,
        sender_profile:profiles!messages_sender_id_fkey(id, name, image)
      `)
      .single();

    if (!error && data) {
      console.log('✅ Message sent successfully with profile:', data);
      return { success: true, data };
    }

    console.log('⚠️ Foreign key query failed, using fallback:', error?.message);
    
    // Fallback: Send message without foreign key relationship
    return await sendMessageFallback(conversationId, senderId, content, mediaUrl, mediaType);
    
  } catch (error) {
    console.error('❌ Exception in sendMessage:', error);
    return await sendMessageFallback(conversationId, senderId, content, mediaUrl, mediaType);
  }
};

/**
 * Fallback method to send message without foreign key relationships
 */
/**
 * Fallback method to send message without foreign key relationships
 */
const sendMessageFallback = async (conversationId, senderId, content, mediaUrl = null, mediaType = null) => {
  try {
    console.log('📤 Using fallback method to send message');
    // Simple insert without foreign key relationships
    const { data: messageData, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        media_url: mediaUrl,
        media_type: mediaType
      })
      .select('id, conversation_id, sender_id, content, media_url, media_type, is_read, created_at')
      .single();

    if (insertError) {
      console.error('❌ Fallback insert failed:', insertError);
      return { 
        success: false, 
        msg: `Database insert failed: ${insertError.message}`,
        error: insertError
      };
    }

    if (!messageData) {
      console.error('❌ No message data returned from insert');
      return { 
        success: false, 
        msg: 'No message data returned from database'
      };
    }

    console.log('✅ Fallback message inserted successfully:', messageData);

    // Get sender profile separately
    const profileResult = await getUserProfile(senderId);
    const senderProfile = profileResult.success ? profileResult.data : {
      id: senderId,
      name: 'Unknown User',
      image: null
    };

    const completeMessage = {
      ...messageData,
      sender_profile: senderProfile
    };

    console.log('✅ Complete message with profile:', completeMessage);
    return { success: true, data: completeMessage };
    
  } catch (error) {
    console.error('❌ Exception in fallback send:', error);
    return { 
      success: false, 
      msg: `Send failed: ${error.message}`,
      error: error
    };
  }
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (conversationId, userId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      console.log('Error marking messages as read:', error);
      return { success: false, msg: error.message };
    }

    return { success: true };
  } catch (error) {
    console.log('Exception in markMessagesAsRead:', error);
    return { success: false, msg: error.message };
  }
};

/**
 * Get unread message count for a user
 */
export const getUnreadMessageCount = async (userId) => {
  try {
    const { data, error, count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('is_read', false)
      .neq('sender_id', userId);

    if (error) {
      throw error;
    }
    return { success: true, count: count || 0 };
  } catch (error) {
    console.log('Exception in getUnreadMessageCount:', error);
    return { success: false, msg: error.message, count: 0 };
  }
};

/**
 * Subscribe to new messages in a conversation
 */
export const subscribeToConversationMessages = (conversationId, callback) => {
  console.log('🔗 Setting up real-time subscription for conversation:', conversationId);
  
  // Create a unique channel name to avoid conflicts
  const channelName = `messages:${conversationId}:${Date.now()}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        console.log('📨 Real-time message received:', payload);
        
        try {
          // Get the complete message data with fresh query
          const { data: messageData, error: msgError } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, is_read, created_at')
            .eq('id', payload.new.id)
            .single();

          if (msgError || !messageData) {
            console.error('❌ Error fetching message in subscription:', msgError);
            return;
          }

          console.log('📋 Message data fetched:', messageData);

          // Get sender profile
          const profileResult = await getUserProfile(messageData.sender_id);
          const senderProfile = profileResult.success ? profileResult.data : {
            id: messageData.sender_id,
            name: 'Unknown User',
            image: null
          };

          const completeMessage = {
            ...messageData,
            sender_profile: senderProfile
          };

          console.log('✅ Complete message prepared for callback:', completeMessage);
          
          // Send the message to the callback
          callback(completeMessage);
          
        } catch (error) {
          console.error('❌ Error in message subscription callback:', error);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('📡 Subscription status changed:', status);
      
      if (err) {
        console.error('❌ Subscription error:', err);
      }
      
      switch (status) {
        case 'SUBSCRIBED':
          console.log('✅ Successfully subscribed to real-time messages');
          break;
        case 'CHANNEL_ERROR':
          console.error('❌ Real-time subscription channel error');
          break;
        case 'TIMED_OUT':
          console.error('❌ Real-time subscription timed out');
          break;
        case 'CLOSED':
          console.log('🔒 Real-time subscription closed');
          break;
        default:
          console.log('📡 Subscription status:', status);
      }
    });
    
  return channel;
};

/**
 * Subscribe to conversation updates
 */
export const subscribeToUserConversations = (userId, callback) => {
  return supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_1=eq.${userId}`,
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_2=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};
