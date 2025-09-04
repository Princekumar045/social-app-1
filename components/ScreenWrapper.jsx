import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ScreenWrapper = ({ children, bg = 'white' }) => {
  const { top } = useSafeAreaInsets();
  const paddingTop = top > 0 ? top + 5 : 30;
  const isWeb = Platform.OS === 'web';

  return (
    <View style={[
      styles.container,
      {
        paddingTop,
        backgroundColor: bg,
      },
      isWeb && styles.webContainer
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webContainer: {
    ...(Platform.OS === 'web' && {
      width: '100%',
      alignSelf: 'center',
    }),
  },
});

export default ScreenWrapper;