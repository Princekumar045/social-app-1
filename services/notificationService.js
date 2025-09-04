import { supabase } from "../lib/supabase";

export const createNotification = async (notification) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) {
      console.log('Notification error:', error);
      return { success: false, msg: 'Something went wrong with the notification' };
    }

    return { success: true, data: data };
  } catch (error) {
    console.log('createNotification error:', error);
    return { success: false, msg: 'Could not create notification' };
  }
};

export const createLikeNotification = async (senderId, receiverId, postId) => {
  console.log('Creating like notification:', { senderId, receiverId, postId });
  
  if (senderId === receiverId) {
    console.log('Skipping notification: user liked their own post');
    return; // Don't notify yourself
  }
  
  try {
    // Check if a like notification for this post already exists from this sender
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('title', 'liked your post')
      .eq('data', JSON.stringify({ postId }))
      .single();

    // If notification already exists, don't create a duplicate
    if (existingNotification) {
      console.log('Like notification already exists, skipping');
      return { success: true, data: existingNotification };
    }

    const notification = {
      sender_id: senderId,
      receiver_id: receiverId,
      title: 'liked your post',
      data: JSON.stringify({ postId })
    };

    console.log('Creating new like notification:', notification);
    const result = await createNotification(notification);
    console.log('Like notification result:', result);
    return result;
  } catch (error) {
    console.log('createLikeNotification error:', error);
    return { success: false, msg: 'Could not create like notification' };
  }
};

export const removeLikeNotification = async (senderId, receiverId, postId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('title', 'liked your post')
      .eq('data', JSON.stringify({ postId }));

    if (error) {
      console.log('Remove like notification error:', error);
      return { success: false, msg: 'Could not remove like notification' };
    }

    return { success: true };
  } catch (error) {
    console.log('removeLikeNotification error:', error);
    return { success: false, msg: 'Could not remove like notification' };
  }
};

export const createCommentNotification = async (senderId, receiverId, postId, commentId) => {
  console.log('Creating comment notification:', { senderId, receiverId, postId, commentId });
  
  if (senderId === receiverId) {
    console.log('Skipping notification: user commented on their own post');
    return; // Don't notify yourself
  }
  
  const notification = {
    sender_id: senderId,
    receiver_id: receiverId,
    title: 'commented on your post',
    data: JSON.stringify({ postId, commentId })
  };

  console.log('Creating new comment notification:', notification);
  const result = await createNotification(notification);
  console.log('Comment notification result:', result);
  return result;
};

export const fetchNotifications = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:profiles!notifications_sender_id_fkey(id, name, avatar_url)
      `)
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.log('Fetch notifications error:', error);
      return { success: false, msg: 'Could not fetch notifications' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.log('fetchNotifications error:', error);
    return { success: false, msg: 'Could not fetch notifications' };
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.log('Mark notification as read error:', error);
      return { success: false, msg: 'Could not mark notification as read' };
    }

    return { success: true };
  } catch (error) {
    console.log('markNotificationAsRead error:', error);
    return { success: false, msg: 'Could not mark notification as read' };
  }
};
