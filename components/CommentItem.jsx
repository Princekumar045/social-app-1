import moment from 'moment';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import { hp, wp } from '../helpers/common';
import Avatar from './Avatar';
import ProfileImageModal from './ProfileImageModal';

const CommentItem = ({ item, currentUser, onDelete, router }) => {
  // Profile image modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  console.log('CommentItem: Rendering comment', item.id, 'for user', currentUser?.id);
  console.log('CommentItem: Comment userId fields:', {
    userId: item.userId,
    users_id: item.users?.id,
    users_name: item.users?.username ? `@${item.users.username}` : item.users?.name,
    hasUsers: !!item.users
  });
  
  const createdAt = item?.created_at && moment(item.created_at).isValid() 
    ? moment(item.created_at).format('MMM D, h:mm A')
    : 'Now';

  const canDelete = currentUser?.id === item.userId || 
                   currentUser?.id === item.users?.id;
  
  console.log('CommentItem: Can delete?', canDelete);

  const handleDelete = () => {
    console.log('CommentItem: Delete button pressed for comment:', item.id);
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('CommentItem: Confirmed delete for comment:', item.id);
            onDelete(item.id);
          },
        },
      ]
    );
  };

  // const onDeletePost = async (item) => {
  //   console.log('delete posts: ', item);
  // }

  // const onEditPost = async (item) => {
  //   console.log('edit posts: ', item);
  // }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity 
            onPress={() => router && router.push(`/main/userProfile?id=${item?.users?.id || item?.userId}`)}
            onLongPress={() => setShowProfileModal(true)}
            delayLongPress={500}
            disabled={!router}
          >
            <Avatar
              size={hp(3.5)}
              uri={item?.users?.image}
              rounded={theme.radius.md}
            />
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <TouchableOpacity 
                onPress={() => router && router.push(`/main/userProfile?id=${item?.users?.id || item?.userId}`)}
                onLongPress={() => router && router.push(`/main/userProfile?id=${item?.users?.id || item?.userId}`)}
                delayLongPress={500}
                disabled={!router}
              >
                <Text style={styles.username}>
                  {item?.users?.username ? `@${item.users.username}` : (item?.users?.name || 'Unknown User')}
                </Text>
              </TouchableOpacity>
              <Text style={styles.timestamp}>{createdAt}</Text>
            </View>
            <Text style={styles.commentText}>{item.text}</Text>
          </View>
        </View>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Profile Image Modal */}
      <ProfileImageModal
        visible={showProfileModal}
        user={item?.users}
        onClose={() => setShowProfileModal(false)}
        router={router}
      />
    </View>
  );
};

export default CommentItem;

const styles = StyleSheet.create({
  container: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(2),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
    gap: wp(2),
  },
  commentContent: {
    flex: 1,
    gap: wp(0.5),
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  username: {
    fontSize: hp(1.6),
    color: theme.colors.textDark,
    fontWeight: theme.fonts.semibold,
  },
  timestamp: {
    fontSize: hp(1.3),
    color: theme.colors.textLight,
  },
  commentText: {
    fontSize: hp(1.5),
    color: theme.colors.text,
    lineHeight: hp(2),
  },
  deleteButton: {
    padding: wp(1),
  },
  deleteText: {
    fontSize: hp(1.3),
    color: theme.colors.rose,
    fontWeight: theme.fonts.medium,
  },
});
