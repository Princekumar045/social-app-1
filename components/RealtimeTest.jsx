import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

const RealtimeTest = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    console.log('🔄 Setting up real-time test subscription...');
    
    const channel = supabase
      .channel('realtime-test')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('📨 Real-time test received message:', payload);
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time test subscription status:', status);
        setConnectionStatus(status);
      });

    return () => {
      console.log('🧹 Cleaning up real-time test subscription');
      channel.unsubscribe();
    };
  }, []);

  const sendTestMessage = async () => {
    if (!newMessage.trim()) return;
    
    console.log('📤 Sending test message:', newMessage);
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: 'test-conversation',
        sender_id: 'test-user',
        content: newMessage.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending test message:', error);
      alert('Error: ' + error.message);
    } else {
      console.log('✅ Test message sent:', data);
      setNewMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Real-time Test</Text>
      <Text style={styles.status}>Status: {connectionStatus}</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type test message..."
        />
        <Button title="Send" onPress={sendTestMessage} />
      </View>
      
      <ScrollView style={styles.messagesContainer}>
        <Text style={styles.messagesHeader}>Messages ({messages.length}):</Text>
        {messages.map((msg, index) => (
          <View key={index} style={styles.message}>
            <Text style={styles.messageText}>{msg.content}</Text>
            <Text style={styles.messageTime}>{new Date(msg.created_at).toLocaleTimeString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
  },
  messagesContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 10,
    borderRadius: 5,
  },
  messagesHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
});

export default RealtimeTest;
