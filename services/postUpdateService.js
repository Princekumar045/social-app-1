import { supabase } from '../lib/supabase';

// Alternative update function that handles the updated_at issue
export const updatePostOnly = async (postId, userId, body, file) => {
  try {
    console.log('Updating post with specific fields:', { postId, userId, body, file });
    
    // First, let's try to check what fields exist in the table
    const { data: tableInfo, error: tableError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('userid', userId)
      .limit(1);
    
    if (tableError) {
      console.log('Error checking existing post:', tableError);
      return { success: false, msg: 'Could not find post to update' };
    }
    
    if (!tableInfo || tableInfo.length === 0) {
      return { success: false, msg: 'Post not found or you do not have permission to edit it' };
    }
    
    console.log('Existing post data:', tableInfo[0]);
    
    // Try updating with minimal fields
    const updateData = { body };
    if (file !== undefined && file !== null) {
      updateData.file = file;
    }
    
    console.log('Attempting update with data:', updateData);
    
    const { data, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId)
      .eq('userid', userId)
      .select();
    
    if (error) {
      console.log('Update error:', error);
      return { success: false, msg: 'Could not update post: ' + error.message };
    }
    
    console.log('Update successful:', data);
    return { success: true, data: data[0] };
    
  } catch (error) {
    console.log('updatePostOnly error:', error);
    return { success: false, msg: 'Could not update post' };
  }
};
