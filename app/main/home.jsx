import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "../../assets/icons";
import FooterNav from '../../components/FooterNav';
import Loading from "../../components/Loading";
import PostCard from "../../components/PostCard";
import ScreenWrapper from "../../components/ScreenWrapper";
import { getTheme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { hp, wp } from "../../helpers/common";
import { useFollowDataRefresh } from "../../hooks/useFollowDataRefresh";
import { supabase } from "../../lib/supabase";
import { fetchPost } from '../../services/postService';
import { useRealtimeNotifications } from '../../services/useRealtimeNotifications';
import { getUserData } from '../../services/userServices';
// import { supabase } from '../../lib/supabaseClient';
 // Example icon import, adjust as needed

var limit= 0;
const Home = () => {
  const { user, setAuth } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  // Initialize follow data refresh hook
  const { isInitialized: followContextInitialized } = useFollowDataRefresh();

  // Get current theme
  const theme = getTheme(isDarkMode);

  // Use real-time notifications hook
  const { unreadCount } = useRealtimeNotifications(user?.id);

  // Get dynamic styles based on current theme
  const styles = getStyles(theme);

  const handlePostEvent =  async (payload) => {
    console.log('📡 Post event received:', payload.eventType, payload);
    
    if(payload.eventType === 'INSERT' && payload?.new?.id) {
      // Check if post already exists to prevent duplicates
      const existingPost = posts.find(post => post.id === payload.new.id);
      if (existingPost) {
        console.log('⚠️ Post already exists, skipping insert');
        return;
      }
      
      // Fetch the new post details and update the state
      let newPost = {...payload.new};
      let res = await getUserData(newPost.userid);
      newPost.profiles = res.success ? res.data : {};
      setPosts((prevPosts) => [newPost, ...prevPosts]);
    }
    else if(payload.eventType === 'UPDATE' && payload?.new?.id) {
      console.log('📝 Updating post in home feed:', payload.new.id);
      // Update the existing post in the state
      setPosts((prevPosts) => {
        const updatedPosts = prevPosts.map(post => {
          if (post.id === payload.new.id) {
            console.log('✅ Post found and updated in feed');
            return {
              ...post,
              ...payload.new
            };
          }
          return post;
        });
        return updatedPosts;
      });
    }
    else if(payload.eventType === 'DELETE' && payload?.old?.id) {
      console.log('🗑️ Removing deleted post from feed:', payload.old.id);
      // Remove the deleted post from the state
      setPosts((prevPosts) => {
        return prevPosts.filter(post => post.id !== payload.old.id);
      });
    }
  }

  useEffect(() => {

    let postChannel = supabase
    .channel('posts')
    .on('postgres_changes', {event: '*', schema: 'public', table: 'posts'}, handlePostEvent)
    .subscribe();

    getPosts();

    return () => {
      supabase.removeChannel(postChannel);
    };
  }, [])

  // Refresh posts when screen comes into focus (e.g., returning from edit screen)
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Home screen focused, refreshing posts...');
      // Only refresh if we have posts already (don't reload on first mount)
      if (posts.length > 0) {
        getPosts();
      }
    }, [posts.length])
  );

  const handlePostDeleted = (deletedPost) => {
    console.log('handlePostDeleted called with:', deletedPost);
    console.log('Current posts count:', posts.length);
    // Remove the deleted post from the posts state
    setPosts(prevPosts => {
      const newPosts = prevPosts.filter(post => post.id !== deletedPost.id);
      console.log('Posts after deletion:', newPosts.length);
      return newPosts;
    });
  };

  // Add function to manually update a post in the feed
  const updatePostInFeed = (updatedPost) => {
    console.log('📝 Manual post update in feed:', updatedPost.id);
    setPosts(prevPosts => {
      return prevPosts.map(post => {
        if (post.id === updatedPost.id) {
          console.log('✅ Post manually updated in feed');
          return { ...post, ...updatedPost };
        }
        return post;
      });
    });
  };

  const getPosts = async () => {
    setLoading(true);
    if(!hasMore) {
      setLoading(false);
      return null;
    }
    limit = limit + 4;
    console.log('Calling fetchPost with limit:', limit);
    let res = await fetchPost(limit);
    console.log('fetchPost response:', res);
    if(res.success) {
      console.log('Posts data:', res.data);
      console.log('Number of posts received:', res.data?.length || 0);
      if(posts.length==res.data.length) setHasMore(false);
      setPosts(res.data || []);
    } else {
      console.log('Failed to fetch posts:', res.msg);
      setPosts([]);
    }
    setLoading(false);
  };

  // console.log("Current user:", user);

  // const onLogout = async () => {
  //   // setAuth(null);
  //   const { error } = await supabase.auth.signOut();
  //   if (error) {
  //     Alert.alert("Sign Out", "Error signing out. Please try again.");
  //   }
  // };
  return (
    <ScreenWrapper bg={theme.colors.background}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textDark }]}>Meetup</Text>
          <View style={styles.icons}>
            <Pressable 
              onPress={() => router.push("/main/messenger")}
              style={{
                padding: hp(1),
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            > 
              <Icon
                name="message"
                size={hp(3.2)}
                strokeWidth={2}
                color={theme.colors.text}
              />
            </Pressable>
            <Pressable 
              onPress={() => router.push("/main/notification")}
              style={[styles.notificationButton, {
                padding: hp(1),
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                justifyContent: 'center'
              }]}
            >
              <Icon
                name="bell"
                size={hp(3.2)}
                strokeWidth={2}
                color={theme.colors.text}
              />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.rose }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
        
        {/* Posts List */}
        <FlatList
          data={posts}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listStyle}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => {
            return <PostCard
              key={`post-${item.id}`}
              item={item}
              currentUser={user}
              router={router}
              onDeletePost={handlePostDeleted}
              />
            }}
            onEndReached={() => {
              getPosts();
              console.log('got to the end ')
            }}
            onEndReachedThreshold={0}
            ListFooterComponent={hasMore ? (
              <View style={{
                marginVertical: posts.length == 0 ? hp(20) : hp(4),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Loading/>
              </View>
            ):(
              <View style={{
                marginVertical: hp(4),
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: wp(4)
              }}>
                <Text style={[styles.noPosts, { color: theme.colors.text }]}>No more posts</Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.noPostsContainer}>
                <Text style={[styles.noPosts, { color: theme.colors.text }]}>No posts available</Text>
              </View>
            )}
            refreshing={loading}
            onRefresh={getPosts}
            onScroll={({ nativeEvent }) => {
              if (nativeEvent.contentOffset.y <= 0) {
                getPosts();
              }
            }}
            scrollEventThrottle={16}
          />
      </View>
      <FooterNav />
      {/* <Button title="logout" onPress={onLogout} /> */}
    </ScreenWrapper>
  );
};

export default Home;

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    marginBottom: hp(1),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.gray + '20',
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.textDark,
    fontSize: hp(3),
    fontWeight: theme.fonts.bold,
    letterSpacing: 0.5,
  },
  avatarImage: {
    height: hp(4.3),
    width: hp(4.3),
    borderRadius: theme.radius.sm,
    borderCurve: "continuous",
    borderColor: theme.colors.gray,
    borderWidth: 3,
  },
  icons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: hp(2.5),
  },
  notificationButton: {
    position: "relative",
    padding: hp(0.5),
    borderRadius: theme.radius.sm,
  },
  badge: {
    position: "absolute",
    right: -hp(0.5),
    top: -hp(0.5),
    backgroundColor: theme.colors.rose,
    borderRadius: hp(1.2),
    minWidth: hp(2.4),
    height: hp(2.4),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: hp(0.5),
    borderWidth: 2,
    borderColor: theme.colors.background,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  badgeText: {
    color: "white",
    fontSize: hp(1.2),
    fontWeight: theme.fonts.bold,
    textAlign: "center",
  },
  listStyle: {
    paddingTop: hp(1),
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
  },
  noPostsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(15),
    paddingHorizontal: wp(8),
  },
  noPosts: {
    fontSize: hp(2.2),
    textAlign: "center",
    color: theme.colors.text,
    opacity: 0.7,
    fontWeight: theme.fonts.medium,
    lineHeight: hp(3),
  },
  pill: {
    position: "absolute",
    right: -hp(1.2),
    top: -hp(0.5),
    height: hp(2.2),
    width: hp(2.2),
    justifyContent: "center",
    alignItems: "center",
    borderRadius: hp(1.1),
    backgroundColor: theme.colors.roseLight,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  pillText: {
    color: "white",
    fontSize: hp(1.2),
    fontWeight: theme.fonts.bold,
    textAlign: "center",
  },
});
