// Simple real-time message service with direct approach
import { supabase } from '../lib/supabase.js';

export const createSimpleMessageSubscription = (conversationId, onMessage) => {
  console.log('🔄 Creating simple real-time subscription for:', conversationId);
  
  const channel = supabase
    .channel(`simple-messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        console.log('📨 Simple subscription received:', payload.new);
        onMessage(payload.new);
      }
    )
    .subscribe();

  return channel;
};

export const testRealtimeNow = async () => {
  console.log('🧪 Testing real-time immediately...');
  
  // Test if we can send a message
  const testMessage = {
    conversation_id: 'test-123',
    sender_id: 'user-123',
    content: `Test message at ${new Date().toISOString()}`
  };
  
  const { data, error } = await supabase
    .from('messages')
    .insert(testMessage)
    .select()
    .single();
    
  if (error) {
    console.error('❌ Test message failed:', error);
    return false;
  }
  
  console.log('✅ Test message sent:', data);
  return true;
};
