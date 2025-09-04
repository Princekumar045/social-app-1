import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { supabaseUrl } from '../constants';
import { supabase } from '../lib/supabase';

export const getUserImageSrc = imagePath => {
    // If no image path provided, return default
    if (!imagePath) {
        return require('../assets/images/defaultuser.png');
    }
    
    // If it's already a URI object (from ImagePicker), return it directly
    if (typeof imagePath === 'object' && imagePath.uri) {
        return imagePath;
    }
    
    // If it's a string
    if (typeof imagePath === 'string') {
        // Check if it's already a full URL
        if (imagePath.startsWith('http')) {
            return { uri: imagePath };
        }
        // Otherwise, treat as Supabase path
        return getSupabaseFileUrl(imagePath);
    }
    
    // Fallback to default
    return require('../assets/images/defaultuser.png');
}

export const getSupabaseFileUrl = filePath => {
    if(filePath) {
        return {uri: `${supabaseUrl}/storage/v1/object/public/uploads/${filePath}`};
    }
    return null;
}

export const downloadFile = async (url) => {
    try{
        const {uri} = await FileSystem.downloadAsync(url, getLocalFilePath(url)); 
        return uri;   
    }catch(error){
        return null;
    }

}

export  const getLocalFilePath = filePath =>{
    let fileName = filePath.split('/').pop();
    return `${FileSystem.documentDirectory}${fileName}`;    
}

export const uploadImage = async (folderName, fileUri, isImage) => {
    try {
        console.log(`Uploading ${isImage ? 'image' : 'video'} to ${folderName}`);
        let fileName = getFilePath(folderName, isImage, isImage ? '.jpg' : '.mp4');
        console.log('Generated fileName:', fileName);
        let imageData;

        if (Platform.OS === 'web') {
            // For web, convert blob to file for direct upload
            const response = await fetch(fileUri);
            const blob = await response.blob();
            imageData = blob;
            console.log('Web blob size:', blob.size);
        } else {
            // For mobile, use FileSystem to read as base64
            const fileBase64 = await FileSystem.readAsStringAsync(fileUri, { 
                encoding: FileSystem.EncodingType.Base64 
            });
            imageData = decode(fileBase64);
            console.log('Mobile base64 decoded size:', imageData.byteLength);
        }

        let {data, error} = await supabase
        .storage
        .from('uploads')
        .upload(fileName, imageData, {
            cacheControl: '3600',
            upsert: false,
            contentType: isImage ? 'image/*' : 'video/*',
        });

        if(error){
            console.error("Upload error:", error);
            return { success: false, msg: 'Could not upload media' };
        }

        console.log('Upload successful, data:', data);
        
        // Return just the file path instead of the full URL
        // This allows PostCard to properly detect image vs video files
        return { success: true, data: data.path };

    } catch (error) {
        console.error("Image upload error:", error);
        return { success: false, msg: 'Could not upload media' };
    }
}

export const getFilePath = (folderName, isImage, fileExtension = null) => {
    let extension = '.jpg'; // default to jpg for images
    
    if (isImage) {
        extension = '.jpg';
    } else {
        extension = fileExtension || '.mp4';
    }
    
    return `/${folderName}/${new Date().getTime()}${extension}`;
}

// New uploadFile function that handles both images and videos
export const uploadFile = async (folderName, fileUri, isImage) => {
    try {
        console.log(`Uploading ${isImage ? 'image' : 'video'} to ${folderName}`);
        
        // Determine if it's an image or video based on file type
        let actualIsImage = isImage;
        let fileExtension = null;
        
        // If fileUri is an object (from ImagePicker), check the type
        if (typeof fileUri === 'object' && fileUri.type) {
            actualIsImage = fileUri.type.startsWith('image/');
            console.log('File type detected:', fileUri.type, 'isImage:', actualIsImage);
            
            // Extract proper file extension based on the actual file type
            if (actualIsImage) {
                if (fileUri.type.includes('png')) {
                    fileExtension = '.png';
                } else if (fileUri.type.includes('gif')) {
                    fileExtension = '.gif';
                } else if (fileUri.type.includes('webp')) {
                    fileExtension = '.webp';
                } else {
                    fileExtension = '.jpg'; // default for images
                }
            } else {
                if (fileUri.type.includes('mov') || fileUri.type.includes('quicktime')) {
                    fileExtension = '.mov';
                } else if (fileUri.type.includes('avi')) {
                    fileExtension = '.avi';
                } else if (fileUri.type.includes('webm')) {
                    fileExtension = '.webm';
                } else {
                    fileExtension = '.mp4'; // default for videos
                }
            }
        }
        
        // Use the correct folder based on file type, but respect the passed folderName
        const uploadFolder = actualIsImage ? 'postImages' : 'postVideos';
        let fileName = getFilePath(uploadFolder, actualIsImage, fileExtension);
        console.log('Generated fileName:', fileName);
        
        // Get the file URI - handle both object and string inputs
        const uri = typeof fileUri === 'object' ? fileUri.uri : fileUri;
        
        let fileData;

        if (Platform.OS === 'web') {
            // For web, convert blob to file for direct upload
            const response = await fetch(uri);
            const blob = await response.blob();
            fileData = blob;
            console.log('Web blob size:', blob.size);
        } else {
            // For mobile, use FileSystem to read as base64
            const fileBase64 = await FileSystem.readAsStringAsync(uri, { 
                encoding: FileSystem.EncodingType.Base64 
            });
            fileData = decode(fileBase64);
            console.log('Mobile base64 decoded size:', fileData.byteLength);
        }

        let {data, error} = await supabase
        .storage
        .from('uploads')
        .upload(fileName, fileData, {
            cacheControl: '3600',
            upsert: false,
            contentType: actualIsImage ? 'image/*' : 'video/*',
        });

        if(error){
            console.error("Upload error:", error);
            return { success: false, msg: 'Could not upload media' };
        }

        console.log('Upload successful, data:', data);
        
        // Return just the file path
        return { success: true, data: data.path };

    } catch (error) {
        console.error("File upload error:", error);
        return { success: false, msg: 'Could not upload media' };
    }
}