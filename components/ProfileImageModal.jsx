import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import Avatar from './Avatar';
import { getTheme } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { hp, wp } from '../helpers/common';
import { getUserImageSrc } from '../services/imageServices';

const { width, height } = Dimensions.get('window');

const ProfileImageModal = ({ 
  visible, 
  onClose, 
  user, 
  onViewProfile 
}) => {
  const { isDarkMode } = useTheme();
  const theme = getTheme(isDarkMode);
  const router = useRouter();

  const handleViewProfile = () => {
    onClose();
    if (user?.id) {
      router.push(`/main/userProfile?id=${user.id}`);
    }
  };

  const handleBackdropPress = () => {
    onClose();
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.8)" barStyle="light-content" />
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
              {/* Profile Image */}
              <View style={styles.imageContainer}>
                {user.image ? (
                  <Image 
                    source={getUserImageSrc(user.image)}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Avatar 
                    uri={user.image}
                    size={wp(60)}
                    style={styles.avatarFallback}
                  />
                )}
              </View>

              {/* User Info */}
              <View style={styles.userInfoContainer}>
                <Text style={[styles.userName, { color: theme.colors.textDark }]}>
                  {user.username ? `@${user.username}` : (user.name || 'Unknown User')}
                </Text>
                {user.username && user.name && (
                  <Text style={[styles.realName, { color: theme.colors.textLight }]}>
                    {user.name}
                  </Text>
                )}
                {user.bio && (
                  <Text style={[styles.userBio, { color: theme.colors.textLight }]} numberOfLines={2}>
                    {user.bio}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.button, styles.closeButton, { backgroundColor: theme.colors.gray }]}
                  onPress={onClose}
                >
                  <Text style={[styles.buttonText, { color: theme.colors.textDark }]}>
                    Close
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, styles.profileButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleViewProfile}
                >
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    View Profile
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(5),
  },
  modalContent: {
    width: wp(85),
    maxHeight: hp(70),
    borderRadius: wp(4),
    padding: wp(5),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageContainer: {
    width: wp(60),
    height: wp(60),
    borderRadius: wp(30),
    overflow: 'hidden',
    marginBottom: hp(2),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    alignSelf: 'center',
  },
  userInfoContainer: {
    alignItems: 'center',
    marginBottom: hp(3),
    paddingHorizontal: wp(2),
  },
  userName: {
    fontSize: hp(2.5),
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: hp(0.5),
  },
  realName: {
    fontSize: hp(2),
    textAlign: 'center',
    marginBottom: hp(1),
  },
  userBio: {
    fontSize: hp(1.8),
    textAlign: 'center',
    lineHeight: hp(2.5),
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: wp(3),
  },
  button: {
    flex: 1,
    paddingVertical: hp(1.5),
    borderRadius: wp(2),
    alignItems: 'center',
  },
  closeButton: {
    // Additional styling for close button
  },
  profileButton: {
    // Additional styling for profile button
  },
  buttonText: {
    fontSize: hp(2),
    fontWeight: '600',
  },
});

export default ProfileImageModal;
