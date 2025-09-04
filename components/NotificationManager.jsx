import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NotificationBanner from './NotificationBanner';

const NotificationManager = ({ notifications, onNotificationPress, onNotificationDismiss }) => {
  const [visibleNotifications, setVisibleNotifications] = useState([]);

  useEffect(() => {
    // Show only the latest 3 notifications to avoid cluttering
    const latest = notifications.slice(0, 3);
    setVisibleNotifications(latest);
  }, [notifications]);

  const handleDismiss = (notificationId) => {
    setVisibleNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
    onNotificationDismiss?.(notificationId);
  };

  const handlePress = (notification) => {
    handleDismiss(notification.id);
    onNotificationPress?.(notification);
  };

  return (
    <View style={styles.container}>
      {visibleNotifications.map((notification, index) => (
        <View 
          key={notification.id} 
          style={[styles.notificationWrapper, { top: index * 80 }]}
        >
          <NotificationBanner
            notification={notification}
            onPress={handlePress}
            onDismiss={() => handleDismiss(notification.id)}
            visible={true}
            duration={5000}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  notificationWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default NotificationManager;
