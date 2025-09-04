import { supabase } from '../lib/supabase';

export const ensureUserProfile = async () => {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Auth error:', authError);
      return { success: false, msg: 'Authentication error' };
    }

    if (!user) {
      console.log('No authenticated user found');
      return { success: false, msg: 'No authenticated user' };
    }

    // Check if user profile exists
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('User profile check error:', userError);
      return { success: false, msg: 'Error checking user profile' };
    }

    if (!userProfile) {
      // Create user profile if it doesn't exist
      const { data: newUserProfile, error: createError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email,
          image: user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('User profile creation error:', createError);
        return { success: false, msg: 'Could not create user profile' };
      }

      console.log('Created new user profile:', newUserProfile);
      return { success: true, data: newUserProfile };
    }

    console.log('User profile exists:', userProfile);
    return { success: true, data: userProfile };
  } catch (error) {
    console.error('ensureUserProfile error:', error);
    return { success: false, msg: 'Error ensuring user profile' };
  }
};
