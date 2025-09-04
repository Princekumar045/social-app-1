import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SearchIcon from '../../assets/icons/Search';
import Avatar from '../../components/Avatar';
import FooterNav from '../../components/FooterNav';
import ProfileImageModal from '../../components/ProfileImageModal';
import ScreenWrapper from '../../components/ScreenWrapper';
import { getTheme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { hp, wp } from '../../helpers/common';
import { getAllUsers, searchUsers } from '../../services/userServices';

const UserList = () => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const theme = getTheme(isDarkMode);
  const styles = getStyles(theme);

  // Fetch all users initially
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        const res = await getAllUsers();
        if (res.success) {
          setUsers(res.data);
          if (!search) setFiltered(res.data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Debounced search functionality
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search.trim()) {
        handleSearch();
      } else {
        setIsSearchMode(false);
        setFiltered(users);
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, users, currentUser?.id]);

  const handleSearch = useCallback(async () => {
    if (!search.trim() || !currentUser?.id) {
      setIsSearchMode(false);
      setFiltered(users);
      return;
    }

    setIsSearchMode(true);
    setSearchLoading(true);
    
    try {
      const result = await searchUsers(search.trim(), currentUser.id);
      if (result.success) {
        setFiltered(result.data || []);
      } else {
        console.error('Search failed:', result.msg);
        setFiltered([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setFiltered([]);
    } finally {
      setSearchLoading(false);
    }
  }, [search, currentUser?.id, users]);

  const handleSearchFocus = () => {
    if (!search.trim() && users.length > 0) {
      setFiltered(users);
    }
  };

  return (
    <ScreenWrapper bg={theme.colors.background}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.textDark }]}>Search Users</Text>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.colors.backgroundSecondary }]}>
          <SearchIcon size={hp(2.5)} color={theme.colors.textLight} />
          <TextInput
            style={[styles.input, { color: theme.colors.text }]}
            placeholder="Search users..."
            value={search}
            onChangeText={setSearch}
            onFocus={handleSearchFocus}
            placeholderTextColor={theme.colors.textLight}
          />
          {searchLoading && (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          )}
        </View>

        {/* Search Info */}
        {isSearchMode && (
          <View style={styles.searchInfo}>
            <Text style={[styles.searchInfoText, { color: theme.colors.textLight }]}>
              {searchLoading ? 'Searching...' : `${filtered.length} users found`}
            </Text>
          </View>
        )}

        {/* Users List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.userRow, { backgroundColor: theme.colors.background }]} 
              onPress={() => router.push(`/main/userProfile?id=${item.id}`)}
              onLongPress={() => router.push(`/main/userProfile?id=${item.id}`)}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                onLongPress={() => {
                  setSelectedUser(item);
                  setShowProfileModal(true);
                }}
                delayLongPress={500}
                activeOpacity={1}
              >
                <Avatar 
                  uri={item.image} 
                  size={hp(6)} 
                  rounded={hp(3)} 
                  style={styles.avatar}
                />
              </TouchableOpacity>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.colors.textDark }]}>
                  {item.username ? `@${item.username}` : item.name}
                </Text>
                {item.email && (
                  <Text style={[styles.userEmail, { color: theme.colors.textLight }]}>
                    {item.email}
                  </Text>
                )}
                {item.bio && (
                  <Text style={[styles.userBio, { color: theme.colors.textLight }]} numberOfLines={1}>
                    {item.bio}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textLight }]}>
                {loading ? 'Loading users...' : 
                 searchLoading ? 'Searching...' :
                 search ? 'No users found.' : 
                 'No users available.'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.colors.gray + '30' }]} />
          )}
        />
      </View>
      <FooterNav />

      {/* Profile Image Modal */}
      <ProfileImageModal
        visible={showProfileModal}
        user={selectedUser}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUser(null);
        }}
        router={router}
      />
    </ScreenWrapper>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.gray + '30',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: hp(3),
    fontWeight: theme.fonts.bold,
    color: theme.colors.textDark,
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary || theme.colors.gray + '20',
    borderRadius: theme.radius.xl,
    marginHorizontal: wp(4),
    marginVertical: hp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  input: {
    flex: 1,
    marginLeft: wp(3),
    fontSize: hp(2),
    color: theme.colors.text,
    fontWeight: theme.fonts.medium,
  },
  searchInfo: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(1),
  },
  searchInfoText: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
  },
  listContainer: {
    paddingBottom: hp(2),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    backgroundColor: theme.colors.background,
  },
  avatar: {
    borderWidth: 2,
    borderColor: theme.colors.gray + '30',
  },
  userInfo: {
    flex: 1,
    marginLeft: wp(4),
    justifyContent: 'center',
  },
  userName: {
    fontSize: hp(2.2),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.textDark,
    marginBottom: hp(0.3),
  },
  userEmail: {
    fontSize: hp(1.8),
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
    marginBottom: hp(0.2),
  },
  userBio: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
    fontStyle: 'italic',
  },
  separator: {
    height: 0.5,
    backgroundColor: theme.colors.gray + '30',
    marginLeft: wp(4) + hp(6) + wp(4), // Account for avatar and padding
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp(10),
    paddingHorizontal: wp(8),
  },
  emptyText: {
    fontSize: hp(2),
    textAlign: 'center',
    color: theme.colors.textLight,
    fontWeight: theme.fonts.medium,
    lineHeight: hp(3),
  },
});

export default UserList;
