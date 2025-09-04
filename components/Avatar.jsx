import { Image, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { hp } from '../helpers/common';
import { getUserImageSrc } from '../services/imageServices';

const Avatar = ({
    uri,
    size = hp(4.5),
    rounded = theme.radius.md,
    style = {},
}) => {
  console.log('Avatar received URI:', uri);
  const imageSource = getUserImageSrc(uri);
  console.log('Avatar computed image source:', imageSource);
  
  return (
    <Image
      source={imageSource}
      style={[styles.avatar, { height: size, width: size, borderRadius: rounded }, style]}
      resizeMode="cover"
    />
  )
}

export default Avatar

const styles = StyleSheet.create({
    avatar: {
        borderCurve: 'continuous',
        borderColor: theme.colors.darkLight,
        borderWidth: 1,
    }
})