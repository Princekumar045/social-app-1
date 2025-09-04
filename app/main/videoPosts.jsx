import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import FooterNav from '../../components/FooterNav';
import Loading from '../../components/Loading';
import PostCard from '../../components/PostCard';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { fetchVideoPosts } from '../../services/postService';

const VideoPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    getVideoPosts();
  }, []);

  const getVideoPosts = async () => {
    setLoading(true);
    const res = await fetchVideoPosts();
    if (res.success) {
      setPosts(res.data);
    } else {
      setPosts([]);
    }
    setLoading(false);
  };

  return (
    <ScreenWrapper bg="white">
      <View style={styles.container}>
        <Text style={styles.title}>Video Posts</Text>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <PostCard item={item} currentUser={user} router={router} />
          )}
          ListEmptyComponent={loading ? <Loading /> : <Text>No video posts found.</Text>}
        />
      </View>
      <FooterNav />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.text,
  },
});

export default VideoPosts;
