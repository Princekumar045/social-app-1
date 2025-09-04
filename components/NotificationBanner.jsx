import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../constants/theme';
import Avatar from './Avatar';

const NotificationBanner = ({ 
  notification, 
  onPress, 
  onDismiss, 
  visible = true,
  duration = 4000 
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide down and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      const timer = setTimeout(() => {
        dismissNotification();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dismissNotification = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: -100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const handlePress = () => {
    dismissNotification();
    onPress?.(notification);
  };

  if (!notification || !visible) return null;

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'message':
        return 'chatbubble';
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble-outline';
      case 'follow':
        return 'person-add';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = () => {
    switch (notification.type) {
      case 'message':
        return theme.colors.primary;
      case 'like':
        return theme.colors.rose;
      case 'comment':
        return theme.colors.blue;
      case 'follow':
        return theme.colors.green;
      default:
        return theme.colors.dark;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notification}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconBackground, { backgroundColor: getNotificationColor() }]}>
              <Ionicons 
                name={getNotificationIcon()} 
                size={20} 
                color="white" 
              />
            </View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(notification.timestamp)}
            </Text>
          </View>

          {notification.senderAvatar && (
            <Avatar 
              uri={notification.senderAvatar}
              size={40}
              style={styles.avatar}
            />
          )}
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={dismissNotification}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={theme.colors.textLight} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const formatTimestamp = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 15,
    right: 15,
    zIndex: 1000,
    elevation: 1000,
  },
  notification: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBackground: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: theme.colors.textLight,
    marginBottom: 2,
    lineHeight: 16,
  },
  timestamp: {
    fontSize: 11,
    color: theme.colors.textLight,
    opacity: 0.7,
  },
  avatar: {
    marginLeft: 8,
  },
  dismissButton: {
    padding: 5,
  },
});

export default NotificationBanner;
