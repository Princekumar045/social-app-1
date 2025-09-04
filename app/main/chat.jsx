import { Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ArrowLeft from '../../assets/icons/ArrowLeft';
import Send from '../../assets/icons/Send';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useAuth } from '../../contexts/AuthContext';
import { hp, wp } from '../../helpers/common';
import { supabase } from '../../lib/supabase';
import {
  getConversationDetails,
  getConversationMessages,
  getOrCreateConversation,
  getUserProfile,
  markMessagesAsRead,
  sendMessage,
  subscribeToConversationMessages,
} from '../../services/messageService';

const Chat = () => {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { conversationId, otherUserId, otherUserName, otherUserImage } = params;

  // Media picker handler
  const handlePickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setMediaPreview({
          uri: asset.uri,
          type: asset.type?.startsWith('video') ? 'video' : 'image',
        });
      }
    } catch (error) {
      console.error('Error picking media:', error);
    }
  };

  // Debug and validate parameters
  console.log('🔍 Chat component params:', {
    conversationId,
    otherUserId,
    otherUserName,
    otherUserImage,
    allParams: params
  });

  // State for derived otherUserId when missing and conversation creation
  const [derivedOtherUserId, setDerivedOtherUserId] = useState(otherUserId);
  const [missingUserIdError, setMissingUserIdError] = useState(false);
  const [actualConversationId, setActualConversationId] = useState(conversationId);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [savingImage, setSavingImage] = useState(false);

  // Function to save image to phone gallery
  const saveImageToGallery = async (imageUri) => {
    try {
      setSavingImage(true);
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to save images to your gallery');
        return;
      }

      let localUri;
      
      // Check if it's a data URI (base64 encoded image)
      if (imageUri.startsWith('data:')) {
        // For data URIs, write directly to file system
        const base64Data = imageUri.split(',')[1];
        const fileName = `temp-image-${Date.now()}.jpg`;
        localUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(localUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        // For HTTP/HTTPS URLs, download the image
        const fileName = `temp-image-${Date.now()}.jpg`;
        localUri = FileSystem.documentDirectory + fileName;
        const { uri } = await FileSystem.downloadAsync(imageUri, localUri);
        localUri = uri;
      }
      
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Success', 'Image saved to gallery!');
      
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image to gallery');
    } finally {
      setSavingImage(false);
    }
  };

  // Function to create conversation if missing
  const createMissingConversation = async () => {
    if (!user?.id || !otherUserId) {
      console.error('❌ Cannot create conversation - missing user IDs');
      return false;
    }

    try {
      setCreatingConversation(true);
      console.log('🔄 Creating conversation between:', user.id, 'and', otherUserId);
      
      const response = await getOrCreateConversation(user.id, otherUserId);
      
      if (response.success) {
        setActualConversationId(response.data);
        console.log('✅ Conversation created/found:', response.data);
        return true;
      } else {
        console.error('❌ Failed to create conversation:', response.msg);
        return false;
      }
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      return false;
    } finally {
      setCreatingConversation(false);
    }
  };

  // Handle missing conversationId
  if (!actualConversationId) {
    if (otherUserId && user?.id && !creatingConversation) {
      // Attempt to create conversation
      createMissingConversation();
      
      return (
        <ScreenWrapper bg="white">
          <View style={styles.errorContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Creating conversation...</Text>
          </View>
        </ScreenWrapper>
      );
    } else if (creatingConversation) {
      return (
        <ScreenWrapper bg="white">
          <View style={styles.errorContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Creating conversation...</Text>
          </View>
        </ScreenWrapper>
      );
    } else {
      console.error('❌ Missing conversationId and unable to create one');
      return (
        <ScreenWrapper bg="white">
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unable to load chat. Missing conversation information.</Text>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </Pressable>
          </View>
        </ScreenWrapper>
      );
    }
  }

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUserDetails, setOtherUserDetails] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userOnlineStatus, setUserOnlineStatus] = useState(null);
  const [messageDeliveryStatus, setMessageDeliveryStatus] = useState({});
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ChatHeader component
  const ChatHeader = () => {
    const displayName = otherUserDetails?.username ? `@${otherUserDetails.username}` : (otherUserDetails?.name || otherUserName || 'Unknown User');
    const displayImage = otherUserDetails?.image || otherUserImage;
    
    const getStatusText = () => {
      if (isTyping) return 'typing...';
      if (userOnlineStatus === 'online') return 'Active now';
      if (userOnlineStatus === 'away') return 'Away';
      if (userOnlineStatus && userOnlineStatus.last_seen) {
        const lastSeen = new Date(userOnlineStatus.last_seen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        if (diffMinutes < 1) return 'Active now';
        if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
        if (diffMinutes < 1440) return `Active ${Math.floor(diffMinutes / 60)}h ago`;
        return `Active ${Math.floor(diffMinutes / 1440)}d ago`;
      }
      return 'Active recently';
    };
    
    return (
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <View style={styles.avatarContainer}>
          <Avatar 
            uri={displayImage} 
            size={35} 
            rounded={16}
            style={styles.headerAvatar}
          />
          {userOnlineStatus === 'online' && (
            <View style={styles.onlineIndicator} />
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{displayName}</Text>
          <Text style={[
            styles.headerSubtitle,
            isTyping && styles.typingText
          ]}>
            {getStatusText()}
          </Text>
        </View>
      </View>
    );
  };

  // Function to get missing otherUserId from conversation details
  const fetchMissingUserInfo = async () => {
    if (!actualConversationId || !user?.id) return false;
    
    try {
      console.log('🔍 Fetching missing otherUserId from conversation...');
      const result = await getConversationDetails(actualConversationId, user.id);
      
      if (result.success && result.data.otherUserId) {
        console.log('✅ Found missing otherUserId:', result.data.otherUserId);
        setDerivedOtherUserId(result.data.otherUserId);
        setMissingUserIdError(false);
        return true;
      } else {
        console.log('❌ Could not determine otherUserId:', result.msg);
        setMissingUserIdError(true);
        return false;
      }
    } catch (error) {
      console.log('❌ Error fetching conversation details:', error);
      setMissingUserIdError(true);
      return false;
    }
  };

  useEffect(() => {
    let subscription = null;
    let realtimeCheckInterval = null;
    
    const initializeChat = async () => {
      // If we have both required params, proceed normally
      if (actualConversationId && (otherUserId || derivedOtherUserId)) {
        const effectiveOtherUserId = otherUserId || derivedOtherUserId;
        console.log('✅ Using otherUserId:', effectiveOtherUserId);
        await fetchUserDetails();
        await fetchMessages();
        await markAsRead();
        subscription = setupRealtimeSubscriptions();
        
        // Set up a periodic check to ensure real-time is working
        realtimeCheckInterval = setInterval(() => {
          console.log('🔄 Checking real-time connection health...');
          // Refresh messages every 30 seconds as backup
          fetchMessages();
        }, 30000); // 30 seconds
      } 
      // If we're missing otherUserId, try to fetch it
      else if (actualConversationId && !otherUserId && !derivedOtherUserId) {
        console.log('⚠️ Missing otherUserId, attempting to fetch from conversation...');
        const success = await fetchMissingUserInfo();
        if (success) {
          // The useEffect will re-run due to derivedOtherUserId state change
          console.log('🔄 Will retry with derived otherUserId');
        }
      } 
      else {
        console.log('❌ Missing required parameters - actualConversationId:', actualConversationId, 'otherUserId:', otherUserId);
      }
    };

    initializeChat();
    
    // Cleanup function
    return () => {
      if (subscription && typeof subscription === 'function') {
        subscription();
      }
      
      if (realtimeCheckInterval) {
        clearInterval(realtimeCheckInterval);
      }
    };
  }, [actualConversationId, otherUserId, derivedOtherUserId, user?.id]);

  // Show error screen if required parameters are missing and we couldn't derive them
  if (!actualConversationId || (!otherUserId && !derivedOtherUserId && missingUserIdError)) {
    return (
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={hp(3.2)} strokeWidth={2.5} color="#1f2937" />
            </Pressable>
            <Text style={styles.title}>Chat Error</Text>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Unable to load chat. Missing required information.
            </Text>
            <Text style={styles.errorDetails}>
              ConversationId: {actualConversationId || 'Missing'}
            </Text>
            <Text style={styles.errorDetails}>
              OtherUserId: {otherUserId || 'Missing'}
            </Text>
            <Pressable onPress={() => router.back()} style={styles.backToHome}>
              <Text style={styles.backToHomeText}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  const fetchUserDetails = async () => {
    const effectiveOtherUserId = otherUserId || derivedOtherUserId;
    
    if (!effectiveOtherUserId) {
      console.log('❌ No otherUserId provided for fetchUserDetails');
      return;
    }
    
    console.log('🔍 Fetching user details for:', effectiveOtherUserId);
    
    try {
      const response = await getUserProfile(effectiveOtherUserId);
      console.log('📊 getUserProfile response:', response);
      
      if (response.success && response.data) {
        console.log('✅ User details fetched successfully:', response.data.username ? `@${response.data.username}` : response.data.name);
        setOtherUserDetails(response.data);
        
        // Set online status
        setUserOnlineStatus({
          status: Math.random() > 0.3 ? 'online' : 'away',
          last_seen: new Date(Date.now() - Math.random() * 3600000).toISOString()
        });
      } else {
        console.log('⚠️ Failed to fetch user details:', response.msg || 'Unknown error');
        
        // Set fallback user details
        setOtherUserDetails({
          id: effectiveOtherUserId,
          name: otherUserName || 'Unknown User',
          image: otherUserImage || null,
          bio: 'User profile not found',
          email: ''
        });
      }
    } catch (error) {
      console.log('❌ Error in fetchUserDetails:', error.message);
      
      // Set fallback user details
      setOtherUserDetails({
        id: effectiveOtherUserId,
        name: otherUserName || 'Unknown User',
        image: otherUserImage || null,
        bio: 'Error loading profile',
        email: ''
      });
    }
  };

  const setupRealtimeSubscriptions = () => {
    console.log('🔄 Setting up real-time subscription for conversation:', actualConversationId);
    console.log('🔄 Current user ID:', user?.id);
    
    // Use the proper service function
    const channel = subscribeToConversationMessages(actualConversationId, (newMessage) => {
      console.log('📨 REAL-TIME MESSAGE RECEIVED:', newMessage);
      
      try {
        // Update messages state
        setMessages(prev => {
          console.log('📊 Current messages before update:', prev.length);
          
          // Check if this message already exists (avoid duplicates)
          const existingIndex = prev.findIndex(msg => msg.id === newMessage.id);
          if (existingIndex !== -1) {
            console.log('⚠️ Message already exists, skipping duplicate');
            return prev;
          }
          
          let updated = prev;
          
          // For the current user's messages, replace temporary message if exists
          if (newMessage.sender_id === user?.id) {
            const tempIndex = prev.findIndex(msg => 
              msg.content === newMessage.content && 
              msg.sender_id === user?.id && 
              msg.id.toString().startsWith('temp-')
            );
            
            if (tempIndex !== -1) {
              console.log('🔄 Replacing temporary message with real message at index:', tempIndex);
              updated = [...prev];
              updated[tempIndex] = newMessage;
              
              // Clear the temporary message delivery status
              setMessageDeliveryStatus(prevStatus => {
                const newStatus = { ...prevStatus };
                delete newStatus[prev[tempIndex].id]; // Remove temp status
                newStatus[newMessage.id] = 'delivered'; // Add real message status
                return newStatus;
              });
            } else {
              console.log('➕ Adding new message to state');
              updated = [...prev, newMessage];
            }
          } else {
            console.log('➕ Adding new message to state');
            updated = [...prev, newMessage];
          }
          
          // Sort by created_at to ensure proper order
          updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          
          console.log('📊 Messages after update:', updated.length);
          
          return updated;
        });
        
        // Handle read status and delivery for other users' messages
        if (newMessage.sender_id !== user?.id) {
          console.log('📬 Message from other user, marking as read');
          setTimeout(() => {
            markAsRead();
            // Update the sender's message status to "read"
            updateMessageStatusToRead(newMessage.id);
          }, 500);
          
          setMessageDeliveryStatus(prevStatus => ({
            ...prevStatus,
            [newMessage.id]: 'delivered'
          }));
        } else {
          console.log('📤 Message from current user');
          setMessageDeliveryStatus(prevStatus => ({
            ...prevStatus,
            [newMessage.id]: 'sent'
          }));
        }
        
        // Scroll to bottom for new messages
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 200);
        
      } catch (error) {
        console.error('❌ Error processing real-time message:', error);
      }
    });

    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up real-time subscription');
      if (channel && typeof channel.unsubscribe === 'function') {
        try {
          channel.unsubscribe();
          console.log('✅ Subscription cleaned up successfully');
        } catch (error) {
          console.error('❌ Error cleaning up subscription:', error);
        }
      }
    };
  };

  const fetchMessages = async () => {
    if (!actualConversationId) return;

    const response = await getConversationMessages(actualConversationId);
    if (response.success) {
      setMessages(response.data || []);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
    setLoading(false);
  };

  const markAsRead = async () => {
    if (actualConversationId && user?.id) {
      await markMessagesAsRead(actualConversationId, user.id);
    }
  };

  // Function to update message status to read (Instagram-style)
  const updateMessageStatusToRead = (messageId) => {
    setMessageDeliveryStatus(prevStatus => ({
      ...prevStatus,
      [messageId]: 'read'
    }));
    
    // Also update the actual message in state to mark as read
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, is_read: true } : msg
    ));
  };

  const handleSendMessage = async () => {
    if ((sending || !actualConversationId || !user?.id) || (!messageText.trim() && !mediaPreview)) {
      console.log('❌ Cannot send message - validation failed');
      return;
    }

    setSending(true);
    const content = messageText.trim();
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // Prepare mediaUrl and mediaType if mediaPreview exists
    let mediaUrl = null;
    let mediaType = null;
    if (mediaPreview) {
      mediaUrl = mediaPreview.uri;
      mediaType = mediaPreview.type;
    }

    console.log('📤 Attempting to send message:', {
      content,
      tempId,
      actualConversationId,
      senderId: user.id,
      timestamp: now,
      mediaUrl,
      mediaType
    });

    // Clear input immediately for better UX
    setMessageText('');
    setMediaPreview(null);

    // Add optimistic message for immediate feedback
    const optimisticMessage = {
      id: tempId,
      content,
      sender_id: user.id,
      conversation_id: conversationId,
      created_at: now,
      is_read: false,
      status: 'sending',
      media_url: mediaUrl,
      media_type: mediaType,
      sender_profile: {
        id: user.id,
        name: user.name || 'You',
        image: user.image
      }
    };

    setMessages(prev => {
      const updated = [...prev, optimisticMessage];
      return updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });

    setMessageDeliveryStatus(prevStatus => ({
      ...prevStatus,
      [tempId]: 'sending'
    }));

    // Scroll to bottom immediately for optimistic message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      console.log('📨 Calling sendMessage API...');
      const response = await sendMessage(actualConversationId, user.id, content, mediaUrl, mediaType);
      if (response.success) {
        console.log('✅ Message sent successfully to database:', response.data?.id);
        setMessageDeliveryStatus(prevStatus => ({
          ...prevStatus,
          [tempId]: 'sent'
        }));
        
        console.log('⏳ Waiting for real-time update to replace temp message...');
        
        // Fallback: If real-time doesn't work, update the message manually after delay
        setTimeout(async () => {
          console.log('🔄 Fallback: Checking if real-time update occurred...');
          
          setMessages(prev => {
            const tempIndex = prev.findIndex(msg => msg.id === tempId);
            if (tempIndex !== -1) {
              console.log('🔄 Fallback: Real-time failed, updating manually and refreshing');
              // Force refresh messages to get latest from database
              fetchMessages();
              return prev;
            }
            console.log('✅ Real-time worked, no fallback needed');
            return prev;
          });
          
          setMessageDeliveryStatus(prevStatus => ({
            ...prevStatus,
            [tempId]: 'delivered'
          }));
        }, 3000);
        
      } else {
        console.error('❌ Failed to send message:', response.msg || response.error);
        
        // Remove the optimistic message if sending failed
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        setMessageDeliveryStatus(prevStatus => {
          const newStatus = { ...prevStatus };
          delete newStatus[tempId];
          return newStatus;
        });
        
        // Restore the message text
        setMessageText(content);
        
        // Show error to user
        alert(`Failed to send message: ${response.msg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Exception while sending message:', error);
      
      // Remove the optimistic message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setMessageDeliveryStatus(prevStatus => {
        const newStatus = { ...prevStatus };
        delete newStatus[tempId];
        return newStatus;
      });
      
      // Restore the message text
      setMessageText(content);
      
      // Show error to user
      alert('Failed to send message. Please check your connection and try again.');
    }

    setSending(false);
  };

  const handleTyping = (text) => {
    setMessageText(text);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Mark messages as read when user starts typing (Instagram behavior)
    if (text.length > 0) {
      markAsRead();
    }
    
    // You can implement typing indicators here
    // sendTypingIndicator(conversationId, user.id, true);
    
    // Stop typing indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      // sendTypingIndicator(conversationId, user.id, false);
    }, 2000);
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Debug function to test real-time
  const testRealtimeConnection = async () => {
    console.log('🧪 Testing real-time connection...');
    
    try {
      // Insert a test message directly to database
      const testMessage = {
        conversation_id: conversationId,
        sender_id: 'test-sender-id',
        content: `Test real-time message at ${new Date().toLocaleTimeString()}`
      };
      
      const { data, error } = await supabase
        .from('messages')
        .insert(testMessage)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Test message failed:', error);
        alert('Test failed: ' + error.message);
      } else {
        console.log('✅ Test message inserted:', data);
        alert('Test message sent! Check if it appears in real-time.');
      }
    } catch (error) {
      console.error('❌ Test exception:', error);
      alert('Test exception: ' + error.message);
    }
  };

  // Function to fix stuck sending messages
  const fixStuckMessages = () => {
    console.log('🔧 Fixing stuck messages...');
    setMessages(prev => prev.map(msg => {
      if (msg.status === 'sending' || messageDeliveryStatus[msg.id] === 'sending') {
        console.log('🔧 Fixing stuck message:', msg.id);
        return { ...msg, status: 'delivered' };
      }
      return msg;
    }));
    
    setMessageDeliveryStatus(prevStatus => {
      const newStatus = { ...prevStatus };
      Object.keys(newStatus).forEach(key => {
        if (newStatus[key] === 'sending') {
          newStatus[key] = 'delivered';
        }
      });
      return newStatus;
    });
  };

  const renderMessage = ({ item, index }) => {
    const isMyMessage = item.sender_id === user?.id;
    const showAvatar = !isMyMessage && (
      index === messages.length - 1 || 
      messages[index + 1]?.sender_id !== item.sender_id
    );
    
    const showTime = index === messages.length - 1 || 
      (messages[index + 1] && 
       new Date(messages[index + 1].created_at).getTime() - new Date(item.created_at).getTime() > 300000); // 5 minutes

    const getMessageStatus = () => {
      // Only show status for messages sent by current user
      if (!isMyMessage) return null;
      
      // Check various status states in priority order
      if (item.status === 'sending' || messageDeliveryStatus[item.id] === 'sending') {
        return { icon: '○', color: '#9ca3af', text: 'Sending' }; // Empty circle
      }
      
      if (item.is_read || messageDeliveryStatus[item.id] === 'read') {
        return { icon: '✓✓', color: '#3b82f6', text: 'Read' }; // Double checkmark - read (blue)
      }
      
      if (messageDeliveryStatus[item.id] === 'delivered' || item.status === 'delivered') {
        return { icon: '✓', color: '#9ca3af', text: 'Delivered' }; // Single checkmark - delivered
      }
      
      if (messageDeliveryStatus[item.id] === 'sent' || item.status === 'sent') {
        return { icon: '✓', color: '#9ca3af', text: 'Sent' }; // Single checkmark - sent
      }
      
      // Default state for messages that exist in database (not temp)
      if (!item.id.toString().startsWith('temp_')) {
        return { icon: '✓', color: '#9ca3af', text: 'Delivered' }; // Default delivered
      }
      
      // Fallback for any other state
      return { icon: '✓', color: '#9ca3af', text: 'Sent' }; // Single checkmark
    };

    const isMedia = item.media_url && item.media_type;
    const messageStatus = getMessageStatus();

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {showAvatar && !isMyMessage && (
          <Avatar
            uri={otherUserDetails?.image || otherUserImage}
            size={30}
            rounded={8}
            style={styles.messageAvatar}
          />
        )}
        {isMedia ? (
          <View style={{ alignItems: isMyMessage ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
            {item.media_type === 'image' && (
              <Pressable onPress={() => setFullScreenImage(item.media_url)}>
                <Image
                  source={{ uri: item.media_url }}
                  style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 2 }}
                  resizeMode="cover"
                />
              </Pressable>
            )}
            {item.media_type === 'video' && (
              <Video
                source={{ uri: item.media_url }}
                style={{ width: 220, height: 220, borderRadius: 12, marginBottom: 2 }}
                useNativeControls
                resizeMode="cover"
                isLooping
              />
            )}
            {/* Time and status info below media */}
            {showTime && (
              <View style={[
                styles.messageTimeContainer,
                isMyMessage ? styles.myMessageTimeContainer : styles.otherMessageTimeContainer
              ]}>
                <Text style={styles.messageTime}>
                  {formatMessageTime(item.created_at)}
                </Text>
                {isMyMessage && messageStatus && (
                  <Text style={[
                    styles.messageStatusText,
                    { color: messageStatus.color }
                  ]}>
                    {messageStatus.text}
                  </Text>
                )}
              </View>
            )}
            {(item.status === 'sending' || messageDeliveryStatus[item.id] === 'sending') && (
              <ActivityIndicator
                size="small"
                color={isMyMessage ? "#3b82f6" : "#3b82f6"}
                style={styles.sendingIndicator}
              />
            )}
          </View>
        ) : (
          <View style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.otherMessage,
            item.status === 'sending' && styles.sendingMessage
          ]}>
            <View style={styles.messageContent}>
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}>
                {item.content}
              </Text>
              {isMyMessage && messageStatus && (
                <View style={styles.messageStatusContainer}>
                  <Text style={[
                    styles.messageStatusIcon,
                    { color: messageStatus.color }
                  ]}>
                    {messageStatus.icon}
                  </Text>
                </View>
              )}
              {(item.status === 'sending' || messageDeliveryStatus[item.id] === 'sending') && (
                <ActivityIndicator
                  size="small"
                  color={isMyMessage ? "#ffffff" : "#3b82f6"}
                  style={styles.sendingIndicator}
                />
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenWrapper bg="white">
        <ChatHeader />
        <Loading />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper bg="white">
      <ChatHeader />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }}
        />
        
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>
              {otherUserDetails?.username ? `@${otherUserDetails.username}` : (otherUserDetails?.name || otherUserName)} is typing...
            </Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          {/* Media preview */}
          {mediaPreview && (
            <View style={{ marginRight: 8 }}>
              {mediaPreview.type === 'video' ? (
                <View style={{ width: 60, height: 60, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', borderRadius: 8 }}>
                  <Text style={{ color: '#fff' }}>Video</Text>
                </View>
              ) : (
                <Image source={{ uri: mediaPreview.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
              )}
              <Pressable onPress={() => setMediaPreview(null)} style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#fff', borderRadius: 10, padding: 2 }}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>×</Text>
              </Pressable>
            </View>
          )}
          {/* Pick media button */}
          <Pressable onPress={handlePickMedia} style={{ marginRight: 8, backgroundColor: '#e5e7eb', borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, color: '#3b82f6' }}>+</Text>
          </Pressable>
          <TextInput
            style={styles.textInput}
            value={messageText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
            editable={!sending && !mediaUploading}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendButton, ((!messageText.trim() && !mediaPreview) || sending || mediaUploading) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={(!messageText.trim() && !mediaPreview) || sending || mediaUploading}
          >
            {sending || mediaUploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={16} color="#ffffff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      
      {/* Full-screen image modal */}
      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenContainer}>
          <View style={styles.fullScreenHeader}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setFullScreenImage(null)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, savingImage && styles.saveButtonDisabled]}
              onPress={() => saveImageToGallery(fullScreenImage)}
              disabled={savingImage}
            >
              {savingImage ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2.2),
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: wp(2),
    marginRight: wp(2),
    borderRadius: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: wp(3),
  },
  headerAvatar: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    backgroundColor: '#22c55e',
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: hp(2.2),
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: hp(1.5),
    color: '#6b7280',
    fontWeight: '400',
  },
  typingText: {
    color: '#3b82f6',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    flexGrow: 1,
  },
  messageContainer: {
    marginVertical: hp(0.8),
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: wp(2),
    marginBottom: hp(0.5),
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
    borderRadius: 18,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  myMessage: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 6,
    marginLeft: wp(8),
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  otherMessage: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
    marginRight: wp(8),
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: hp(1.8),
    lineHeight: hp(2.4),
    flexShrink: 1,
  },
  myMessageText: {
    color: '#ffffff',
    fontWeight: '400',
  },
  otherMessageText: {
    color: '#1f2937',
    fontWeight: '400',
  },
  messageStatusContainer: {
    marginLeft: wp(1),
    justifyContent: 'flex-end',
  },
  messageStatusIcon: {
    fontSize: hp(1.4),
    fontWeight: 'bold',
  },
  messageTimeContainer: {
    marginTop: hp(0.3),
    flexDirection: 'row',
    alignItems: 'center',
  },
  myMessageTimeContainer: {
    alignSelf: 'flex-end',
    marginRight: wp(8),
  },
  otherMessageTimeContainer: {
    alignSelf: 'flex-start',
    marginLeft: wp(8),
  },
  messageTime: {
    fontSize: hp(1.2),
    color: '#9ca3af',
    fontWeight: '400',
  },
  messageStatusText: {
    fontSize: hp(1.2),
    fontWeight: '400',
    marginLeft: wp(1),
  },
  sendingIndicator: {
    marginLeft: wp(1),
  },
  messageStatus: {
    fontSize: hp(1.3),
    color: '#9ca3af',
    marginTop: hp(0.3),
    marginRight: wp(1),
    textAlign: 'right',
    fontWeight: '400',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 22,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    fontSize: hp(1.8),
    color: '#1f2937',
    maxHeight: hp(12),
    marginRight: wp(3),
    backgroundColor: '#f9fafb',
    minHeight: 44,
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  typingIndicator: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sendingMessage: {
    opacity: 0.7,
  },
  sendingIndicator: {
    marginLeft: wp(2),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: hp(2.2),
    fontWeight: '500',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: hp(2),
  },
  loadingText: {
    fontSize: hp(2),
    color: '#007AFF',
    textAlign: 'center',
    marginTop: hp(2),
  },
  errorDetails: {
    fontSize: hp(1.8),
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  backToHome: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.5),
    borderRadius: 12,
    marginTop: hp(3),
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  backToHomeText: {
    color: '#ffffff',
    fontSize: hp(1.9),
    fontWeight: '500',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default Chat;
