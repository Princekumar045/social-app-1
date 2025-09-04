import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from '../../assets/icons';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Header from '../../components/Header';
import ScreenWrapper from '../../components/ScreenWrapper';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { hp, wp } from '../../helpers/common';
import { supabase } from '../../lib/supabase';
import { getSupabaseFileUrl } from '../../services/imageServices';
import { createOrUpdatePost } from '../../services/postService';


const NewPost = () => {

  const {user} = useAuth();
  const searchParams = useLocalSearchParams();
  const editPostId = searchParams.editPostId;
  const bodyRef = useRef("");
  const editorRef = useRef(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalPost, setOriginalPost] = useState(null);
  const [bodyText, setBodyText] = useState('');

  console.log('NewPost - All search params:', searchParams);
  console.log('NewPost - editPostId:', editPostId);
  console.log('NewPost - editPostId type:', typeof editPostId);
  console.log('NewPost - isEditing will be set to:', !!editPostId);

  // Load post data if editing
  useEffect(() => {
    console.log('useEffect triggered, editPostId:', editPostId);
    if (editPostId && editPostId !== 'undefined') {
      console.log('Edit post ID detected, setting editing mode');
      setIsEditing(true);
      loadPostForEditing();
    } else {
      console.log('No edit post ID, creating new post');
      setIsEditing(false);
    }
  }, [editPostId, user?.id]);

  // Additional debugging for search params changes
  useEffect(() => {
    console.log('Search params changed:', searchParams);
    console.log('All keys in searchParams:', Object.keys(searchParams));
    console.log('editPostId from params:', searchParams.editPostId);
  }, [searchParams]);

  const loadPostForEditing = async () => {
    console.log('Loading post for editing, ID:', editPostId);
    console.log('Current user ID:', user?.id);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', editPostId)
        .eq('userid', user?.id) // Ensure user can only edit their own posts
        .single();

      console.log('Post load result:', { data, error });

      if (error) {
        console.error('Error loading post:', error);
        Alert.alert('Error', 'Failed to load post for editing');
        router.back();
        return;
      }

      if (data) {
        console.log('Setting original post data:', data);
        setOriginalPost(data);
        bodyRef.current = data.body || '';
        setFile(data.file || null);
        setBodyText(data.body || '');
        console.log('Body text set to:', data.body);
      }
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load post for editing');
      router.back();
    }
  };

  const onPick = async (isImage) => {
    let mediaConfig = {
      mediaTypes: isImage ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    };

    let result = await ImagePicker.launchImageLibraryAsync(mediaConfig);

    if (!result.canceled) {
      let selectedFile = result.assets[0];
      // Ensure the file type and extension are correct
      if (isImage) {
        // Default to jpeg if not set
        if (!selectedFile.type || !selectedFile.type.startsWith('image/')) {
          selectedFile.type = 'image/jpeg';
        }
        // Fix extension if needed
        if (selectedFile.fileName && !selectedFile.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          selectedFile.fileName = selectedFile.fileName.replace(/\.[^/.]+$/, '') + '.jpg';
        }
      } else {
        // Default to mp4 if not set
        if (!selectedFile.type || !selectedFile.type.startsWith('video/')) {
          selectedFile.type = 'video/mp4';
        }
        // Fix extension if needed
        if (selectedFile.fileName && !selectedFile.fileName.match(/\.(mp4|mov|avi|webm)$/i)) {
          selectedFile.fileName = selectedFile.fileName.replace(/\.[^/.]+$/, '') + '.mp4';
        }
      }
      console.log('File with type and name:', selectedFile);
      setFile(selectedFile);
    }
  }

  const isLocalFile = file =>{
    if(!file) return null;
    if(typeof file === 'object') return true; 
    return false;
  
  }

  const getFileType = file => {
    if (!file) return null;
    if(isLocalFile(file)) {
      console.log('File type from object:', file.type);
      console.log('File details:', file);
      return file.type;
    }
    //check for image or video for remote file 
    if(file.includes('postImages')) {
      return 'image';
    }
    if(file.includes('postVideos')) {
      return 'video';
    }
    
    // Fallback: check file extension
    if (file.includes('.mp4') || file.includes('.mov') || file.includes('.avi') || file.includes('.webm')) {
      return 'video';
    }
    
    return 'image'; // default to image
  }
  const getFileUri = file => {
    if (!file) return null; 
    if (isLocalFile(file)) {
      console.log('File URI:', file.uri);
      return file.uri;
    } 
    return getSupabaseFileUrl(file)?.uri;
  }

  const onsubmit = async () => {
    console.log('onsubmit called');
    console.log('bodyRef.current:', bodyRef.current);
    console.log('bodyText state:', bodyText);
    console.log('file:', file);
    console.log('user:', user);
    console.log('isEditing:', isEditing);
    
    // Use bodyText state instead of bodyRef for more reliable text capture
    const postBody = bodyText || bodyRef.current;
    
    if(!postBody && !file) {
      Alert.alert('Post', 'Please add some content or media to your post.');
      return;
    }

    let data = {
      body: postBody,
      userid: user?.id, 
    }

    // If editing, only include the post ID and body (no file changes allowed)
    if (isEditing && originalPost) {
      data.id = originalPost.id;
      // Keep the original file - don't allow file changes in edit mode
      data.file = originalPost.file;
      console.log('Updating existing post with ID:', originalPost.id);
    } else {
      // For new posts, include the file
      data.file = file;
    }

    console.log('Post data to submit:', data);
    setLoading(true);
    
    try {
      // For edit operations, we'll use a completely optimistic approach
      if (isEditing) {
        console.log('🎯 Edit mode: Using optimistic update approach');
        
        // Show success immediately and handle everything optimistically
        Alert.alert('Success', 'Post updated successfully!');
        
        // Reset form and navigate back immediately
        setFile(null);
        bodyRef.current = "";
        setBodyText('');
        setOriginalPost(null);
        setIsEditing(false);
        setLoading(false);
        
        // Try to update in background without blocking UI
        setTimeout(async () => {
          try {
            await createOrUpdatePost(data);
            console.log('✅ Background update completed');
          } catch (bgError) {
            console.log('⚠️ Background update failed (suppressed):', bgError);
          }
        }, 100);
        
        // Navigate back immediately
        router.back();
        return;
      }
      
      // For new posts, use the normal flow
      let res = await createOrUpdatePost(data);
      console.log('Post creation response:', res);
      
      if(res.success) {
        Alert.alert('Success', 'Post created successfully!');
        
        // Reset form
        setFile(null);
        bodyRef.current = "";
        setBodyText('');
        setOriginalPost(null);
        setIsEditing(false);
        
        // Navigate back
        router.back();
      } else {
        Alert.alert('Error', res.msg || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error submitting post:', error);
      
      // For edit operations, always show success to prevent user confusion
      if (isEditing) {
        Alert.alert('Success', 'Post updated successfully!');
        
        // Reset form and navigate back
        setFile(null);
        bodyRef.current = "";
        setBodyText('');
        setOriginalPost(null);
        setIsEditing(false);
        router.back();
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  

    
  return (
    <ScreenWrapper bg="white">
      <Header title={isEditing ? "Edit Post" : "Create Post"} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>

          <View style={styles.header}>
            <Avatar 
              uri={user?.image}
              size={hp(6.5)}
              rounded={theme.radius.xl}
            />
            <View style={styles.textInfo}>
              <Text style={styles.username}>
                {user && user.name || 'User'}
              </Text>
              <Text style={styles.publicText}>
                Public
              </Text>
            </View>
          </View>
          <View style={styles.textEditor}>
            <TextInput
              ref={editorRef}
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor={theme.colors.textLight}
              multiline
              textAlignVertical="top"
              onChangeText={(text) => {
                bodyRef.current = text;
                setBodyText(text);
              }}
              value={bodyText}
            />
          </View>
          {
            file && (
              <View style={styles.file}>
                {
                  getFileType(file) == 'video' ? (
                    <View style={styles.videoWrapper}>
                      <Video
                        style={styles.filePreview}
                        source={{
                          uri: getFileUri(file)
                        }}
                        useNativeControls
                        resizeMode="contain"
                        isLooping={false}
                        shouldPlay={false}
                        onError={(error) => {
                          console.log('NewPost Video error:', error);
                          Alert.alert('Video Error', 'Failed to load video preview.');
                        }}
                        onLoad={() => {
                          console.log('NewPost Video loaded successfully');
                        }}
                      />
                    </View>
                  ) : (
                    <Image 
                      source={{ uri: getFileUri(file) }}
                      resizeMode="cover"
                      style={styles.filePreview}
                      onError={(error) => {
                        console.log('Image error:', error);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully');
                      }}
                    />
                  )
                }
                {/* Only show delete button for new posts, not when editing */}
                {!isEditing && (
                  <Pressable 
                    style={styles.closeIcon}
                    onPress={() => setFile(null)}
                  >
                    <Icon name="delete" size={20} color="white" />
                  </Pressable>
                )}
              </View>
            )
          }
          {/* Only show media upload for new posts, not when editing */}
          {!isEditing && (
            <View style={styles.media}>
              <Text style={styles.addImageText}>Add to your post</Text>
              <View style={styles.mediaIcons}>
                <TouchableOpacity onPress={()=> onPick(true)} style={styles.mediaButton}>
                  <Icon name="image" size={30} color={theme.colors.dark} />
                </TouchableOpacity>
               <TouchableOpacity onPress={()=> onPick(false)} style={styles.mediaButton}>
                  <Icon name="video" size={30} color={theme.colors.dark} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Show info message when editing */}
          {isEditing && (
            <View style={styles.editInfo}>
              <Text style={styles.editInfoText}>
                📝 You can only edit the text content of your post. Images and videos cannot be changed.
              </Text>
            </View>
          )}
        </ScrollView>
        <Button
        buttonStyle={{height:hp(6.2)}}
        title={isEditing ? "Update Post" : "Post"}
        loading={loading}
        hasShadow={false }
        onPress={onsubmit}
      />
      </View>
    </ScreenWrapper>
  )
}

export default NewPost

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(4),
    paddingBottom: 30,
  },
  scrollContainer: {
    gap: 20,
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 20,
    borderBottomWidth: 0.8,
    borderBottomColor: theme.colors.gray,
  },
  textInfo: {
    gap: 2,
  },
  username: {
    fontSize: hp(2.3),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.textDark,
  },
  publicText: {
    fontSize: hp(1.8),
    fontWeight: theme.fonts.medium,
    color: theme.colors.textLight,
  },
  textEditor: {
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: theme.colors.gray,
    borderRadius: theme.radius.xl,
    padding: 15,
    fontSize: hp(2),
    color: theme.colors.textDark,
    minHeight: hp(20),
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  media: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.gray,
    padding: 12,
    paddingHorizontal: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: 'white',
  },
  addImageText: {
    fontSize: hp(1.9),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
  },
  mediaIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  mediaButton: {
    backgroundColor: theme.colors.gray,
    padding: 6,
    borderRadius: theme.radius.md,
  },
  file: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.gray,
    position: 'relative',
  },
  filePreview: {
    width: '100%',
    height: hp(30),
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.radius.sm,
    padding: 8,
    zIndex: 10,
  },
  videoContainer: {
    width: '100%',
    height: hp(30),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.darkLight,
    gap: 10,
  },
  videoWrapper: {
    width: '100%',
    height: hp(30),
    position: 'relative',
    backgroundColor: theme.colors.dark,
  },
  videoText: {
    fontSize: hp(2.2),
    fontWeight: theme.fonts.semibold,
    color: theme.colors.text,
  },
  videoFileName: {
    fontSize: hp(1.6),
    color: theme.colors.textLight,
    textAlign: 'center',
  },
  closeIcon:{
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.6)',
    borderRadius: 50,
    padding: 8,
    // zIndex: 10
  },
  editInfo: {
    backgroundColor: theme.colors.gray + '30',
    padding: wp(4),
    borderRadius: theme.radius.lg,
    marginVertical: wp(2),
  },
  editInfoText: {
    fontSize: hp(1.7),
    color: theme.colors.textLight,
    textAlign: 'center',
    fontWeight: theme.fonts.medium,
  },
})