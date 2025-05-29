"use client";

import { createClient } from './supabase/client';

export async function logout() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error during sign out:', error.message);
    return { error };
  }

  // Clear any remaining auth state
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
  
  return { error: null };
}

export const getSupabaseUser = async () => {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.warn('Error getting user:', error.message);
    return null;
  }
  
  return user;
};

export const getSupabaseSession = async () => {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }
  
  return session;
};
