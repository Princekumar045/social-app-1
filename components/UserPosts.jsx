import { Video } from 'expo-av';
import { useCallback, useEffect, useState } from "react";
import { Dimensions, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";
import { getSupabaseFileUrl } from "../services/imageServices";
import { fetchPost } from "../services/postService";
import Loading from "./Loading";


const UserPosts = ({ userId, currentUser, router }) => {
  // All hooks at the top level
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedTab, setSelectedTab] = useState('media'); // 'media' or 'text'
  const [modalPost, setModalPost] = useState(null);

  // Function to fetch user posts
  const getUserPosts = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Fetch all posts by this user
      const { success, data } = await fetchPost(1000); // fetch all, filter below
      if (success) {
        // Only show posts by this user
        const filtered = data.filter(post => {
          const postUserId = typeof post.userid === 'object' ? post.userid?.toString() : String(post.userid);
          const currentUserId = typeof userId === 'object' ? userId?.toString() : String(userId);
          return postUserId === currentUserId;
        });
        setPosts(filtered);
        console.log(`Loaded ${filtered.length} posts for user ${userId}`);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Set up real-time subscription for posts
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user_posts_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `userid=eq.${userId}`
        },
        (payload) => {
          console.log('Post change detected:', payload);
          
          if (payload.eventType === 'INSERT' && payload.new) {
            // Add new post to the beginning of the list
            setPosts(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            // Update existing post
            setPosts(prev => prev.map(post => 
              post.id === payload.new.id ? payload.new : post
            ));
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remove deleted post
            setPosts(prev => prev.filter(post => post.id !== payload.old.id));
          } else {
            // For other cases, refresh all posts
            getUserPosts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Initial load
  useEffect(() => {
    getUserPosts();
  }, [getUserPosts]);

  // Derived variables (not hooks)
  const textPosts = posts.filter(
    post => !post.file || (typeof post.file === 'string' && post.file.trim() === '')
  );
  const mediaPosts = posts.filter(
    post => {
      if (!post.file) return false;
      if (typeof post.file === 'string' && post.file.trim() !== '') return true;
      if (typeof post.file === 'object' && post.file.uri && post.file.uri.trim() !== '') return true;
      return false;
    }
  );

  if (loading) return <Loading />;
  if (!posts.length) return <Text style={{textAlign:'center',marginTop:40}}>No posts yet.</Text>;

  // Instagram grid: 3 columns, always fill row, align to top, even spacing
  const numColumns = 3;
  let gridWidth = Dimensions.get('window').width;
  let containerStyle = {};
  if (Platform.OS === 'web') {
    gridWidth = Math.min(450, gridWidth); // max width for grid on web
    containerStyle = {
      width: '100%',
      maxWidth: 450,
      margin: '0 auto',
    };
  }
  const gap = 8;
  const size = (gridWidth - gap * (numColumns + 1)) / numColumns;

  // Helper to detect if file is video
  const isVideoFile = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false;
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const lower = filePath.toLowerCase();
    return videoExts.some(ext => lower.endsWith(ext));
  };

  // Tab selection state

  // Modal for post details

  // Tab buttons
  const TabButton = ({ label, value }) => (
    <TouchableOpacity
      style={{
        flex: 1,
        paddingVertical: 10,
        backgroundColor: selectedTab === value ? '#222' : '#f2f2f2',
        borderRadius: 8,
        marginHorizontal: 4,
      }}
      onPress={() => setSelectedTab(value)}
      activeOpacity={0.8}
    >
      <Text style={{ color: selectedTab === value ? '#fff' : '#333', textAlign: 'center', fontWeight: 'bold' }}>{label}</Text>
    </TouchableOpacity>
  );

  // Render
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ flexDirection: 'row', marginBottom: 16, marginTop: 8 }}>
        <TabButton label="Media Posts" value="media" />
        <TabButton label="Text Posts" value="text" />
      </View>

      {selectedTab === 'media' && (
        <FlatList
          data={mediaPosts}
          keyExtractor={item => item.id.toString()}
          numColumns={3}
          renderItem={({ item, index }) => {
            let imageUrl = null;
            if (item.file) {
              if (typeof item.file === 'string') {
                const urlObj = getSupabaseFileUrl(item.file);
                imageUrl = urlObj ? urlObj.uri : null;
              } else if (typeof item.file === 'object' && item.file.uri) {
                imageUrl = item.file.uri;
              }
            }
            const ids = mediaPosts.map(p => p.id).join(',');
            return (
              <TouchableOpacity
                style={{ width: size, height: size, backgroundColor: '#000', marginLeft: gap, marginTop: gap, padding: 0, borderWidth: 0.5, borderColor: '#eee', justifyContent: 'center', alignItems: 'center' }}
                activeOpacity={0.85}
                onPress={() => router.push(`/main/postDetail?ids=${ids}&index=${index}&userId=${userId}`)}
              >
                {/* Show video if file is video, else image */}
                {imageUrl && isVideoFile(item.file) ? (
                  <Video
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    useNativeControls={false}
                    shouldPlay={false}
                    isLooping
                  />
                ) : imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : null}
              </TouchableOpacity>
            );
          }}
          scrollEnabled={false}
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            paddingLeft: 0,
            paddingRight: gap,
            paddingTop: 0,
            paddingBottom: gap,
            ...(Platform.OS === 'web' ? containerStyle : {}),
          }}
          style={{ width: Platform.OS === 'web' ? gridWidth : '100%' }}
        />
      )}

      {selectedTab === 'text' && (
        <FlatList
          data={textPosts}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item, index }) => {
            const ids = textPosts.map(p => p.id).join(',');
            return (
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor: '#eee',
                  borderRadius: 8,
                  marginVertical: 6,
                  padding: 14,
                  backgroundColor: '#f9f9f9',
                  shadowColor: '#000',
                  shadowOpacity: 0.04,
                  shadowRadius: 2,
                  elevation: 1,
                }}
                activeOpacity={0.85}
                onPress={() => router.push(`/main/postDetail?ids=${ids}&index=${index}&userId=${userId}`)}
              >
                <Text style={{ fontSize: 15, color: '#222' }}>{item.body}</Text>
              </TouchableOpacity>
            );
          }}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 10, flexGrow: 1 }}
          style={{ flex: 1, minHeight: 0 }}
        />
      )}

      {/* Modal removed: navigation to detail page instead */}
    </View>
  );
  // (Removed unreachable second return statement)
};

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default UserPosts;