import { supabase } from '../lib/supabase';

// Check and create a missing user profile if needed
export const ensureUserProfile = async (userId, userData) => {
  try {
    console.log('Checking user profile for user:', userId);
    
    // First check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('User check error:', userError);
      return { success: false, msg: 'Error checking user profile' };
    }

    if (!user) {
      // Create user if it doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          name: userData?.name || userData?.email?.split('@')[0] || 'User',
          email: userData?.email,
          image: userData?.image || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('User creation error:', createError);
        return { success: false, msg: 'Could not create user profile' };
      }

      console.log('Created new user:', newUser);
      return { success: true, data: newUser };
    }

    console.log('User exists:', user);
    return { success: true, data: user };
  } catch (error) {
    console.error('ensureUserProfile error:', error);
    return { success: false, msg: 'Error ensuring user profile' };
  }
};
