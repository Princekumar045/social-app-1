import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Call from "../../assets/icons/Call";
import Camera from "../../assets/icons/Camera";
import Location from "../../assets/icons/Location";
import User from "../../assets/icons/User";
import Avatar from "../../components/Avatar";
import Button from "../../components/Button";
import Header from "../../components/Header";
import Input from "../../components/Input";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { hp, wp } from "../../helpers/common";
import { uploadImage } from "../../services/imageServices";
import { updateUser } from "../../services/userServices";

const EditProfile = () => {
  const { user: currentUser, setUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [user, setUser] = useState({
    name: '',
    username: '',
    phoneNumber: '',
    image: null,
    bio: '',
    address: '',
  });

  useEffect(() => {
    if (currentUser) {
      setUser({
        name: currentUser.name || '',
        username: currentUser.username || '',
        phoneNumber: currentUser.phoneNumber || '',
        image: currentUser.image || null,
        bio: currentUser.bio || '',
        address: currentUser.address || '',
      });
    }
  }, [currentUser]);

  const onPickImage = async () => {
     let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      console.log('Image picked:', result.assets[0]);
      setUser({...user, image: result.assets[0]});
    }
  };

  const onSubmit = async () => {
    let userData = {...user };
    let {name, phoneNumber, image, bio, address} = userData;
    if (!name || !phoneNumber || !bio || !address || !image) {
      if (Platform.OS === 'web') {
        alert("Please fill all the fields");
      } else {
        Alert.alert("Profile", "Please fill all the fields");
      }
      return;
    }
    setLoading(true);

    if(typeof image === 'object'){
      // update user image 

      let imageRes = await uploadImage('Profiles', image?.uri, true);
      if(imageRes.success) userData.image = imageRes.data;
      else userData.image = null;
    }
    // update user profile logic here
    const res = await updateUser(currentUser?.id, userData);
    setLoading(false);
    if(res.success){
      setUserData({...currentUser, ...userData});
      router.back();
    }
  }

  const getImageUri = () => {
    const uri = user?.image && typeof user.image === 'object' ? user.image.uri : user?.image;
    console.log('Image URI being passed to Avatar:', uri);
    console.log('User image object:', user?.image);
    return uri;
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <ScrollView style={{ flex: 1 }}>
          <Header title="Edit Profile" />

          {/* form */}
          <View style={styles.form}>
            <View style={styles.avatarContainer}>
              <Avatar 
                uri={getImageUri()}
                size={hp(16)}
                rounded={theme.radius.xxl * 2}
                style={styles.avatar}
              />
              <Pressable 
                style={styles.cameraIcon} 
                onPress={onPickImage}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
              >
                <Camera size={18} strokeWidth={2} color="white" />
              </Pressable>
            </View>
            <Text style={{ fontSize: hp(2.5), textAlign: "center", color: theme.colors.text }}>
              Please fill your profile details below
            </Text>
            <Input
              icon={<User size={20} strokeWidth={1.5} />}
              placeholder="Enter your name"
              value={user.name}
              containerStyles={styles.input}
              onChangeText={(value) => setUser({ ...user, name: value })}
            />
            
            {/* Username Display (Read-only) */}
            {user.username && (
              <View style={styles.usernameDisplay}>
                <User size={20} strokeWidth={1.5} color={theme.colors.textLight} />
                <Text style={styles.usernameText}>@{user.username}</Text>
                <Text style={styles.usernameLabel}>(Username cannot be changed)</Text>
              </View>
            )}
            <Input
              icon={<Call size={20} strokeWidth={1.5} />}
              placeholder="Enter your Phone Number"
              value={user.phoneNumber}
              keyboardType="numeric"
              containerStyles={styles.input}
              onChangeText={(value) => {
                // Only allow numbers
                const numericValue = value.replace(/[^0-9]/g, '');
                setUser({ ...user, phoneNumber: numericValue });
              }}
            />
            <Input
              icon={<Location size={20} strokeWidth={1.5} />}
              placeholder="Enter your address"
              value={user.address}
              containerStyles={styles.input}
              onChangeText={(value) => setUser({ ...user, address: value })}
            />
            <Input
              placeholder="Enter your Bio"
              value={user.bio}
              multiline={true}
              textAlignVertical="top"
              containerStyles={styles.bio}
              onChangeText={(value) => setUser({ ...user, bio: value })}
            />

            <Button 
              title="Update" 
              loading={loading} 
              onPress={onSubmit} 
              buttonStyle={styles.updateButton}
              hasShadow={true}
            />
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default EditProfile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(5),
  },
  avatarContainer: {
    height: hp(16),
    width: hp(16),
    alignSelf: "center",
    marginBottom: hp(3),
  },
  avatar: {
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    padding: 10,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  form: {
    gap: 20,
    marginTop: 10,
    paddingHorizontal: wp(2),
    width: "100%",
    maxWidth: wp(90),
    alignItems: "center",
  },
  input: {
    flexDirection: "row",
    height: hp(7.5),
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 15,
    borderWidth: 1.5,
    borderColor: theme.colors.darkLight,
    borderRadius: theme.radius.lg,
    backgroundColor: "#fafafa",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    width: "100%",
  },
  usernameDisplay: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.darkLight,
    borderRadius: theme.radius.lg,
    backgroundColor: "#f8f8f8",
    marginBottom: hp(2),
    gap: 10,
  },
  usernameText: {
    fontSize: hp(1.8),
    fontWeight: "500",
    color: theme.colors.primary,
  },
  usernameLabel: {
    fontSize: hp(1.4),
    color: theme.colors.textLight,
    fontStyle: "italic",
    marginLeft: 10,
  },
  bio: {
    height: hp(18),
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.darkLight,
    borderRadius: theme.radius.lg,
    backgroundColor: "#fafafa",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    width: "100%",
  },
  updateButton: {
    width: "60%",
    marginTop: hp(.5),
    paddingVertical: hp(1.5),
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
  },
});
